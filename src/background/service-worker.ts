/**
 * SubGuard Service Worker (Manifest V3)
 *
 * Stateless by design — all state is read from storage on each wake event.
 * Handles: install/update lifecycle, renewal alarms, license re-validation,
 * message routing, and notification click navigation.
 */

import browser from '../shared/browser';
import type { Alarms } from 'webextension-polyfill/namespaces/alarms';
import type { Runtime } from 'webextension-polyfill/namespaces/runtime';
import { getAllSubscriptions, db } from '../shared/db';
import { getSettings, setSettings, checkStorageQuota } from '../shared/storage';
import { revalidateStoredLicense, validateLicense } from '../shared/licenseService';
import { runEmailScan, cancelEmailScan } from '../shared/emailScanner';
import {
  alarmName,
  subscriptionIdFromAlarm,
  scheduleRenewalAlarm,
  cancelAlarm,
  reregisterAllAlarms,
  LICENSE_REVALIDATION_ALARM,
} from './alarms';
import { checkNotificationPermission, sendRenewalNotification, sendTrialConversionPrompt } from './notifications';
import type { MessageType, MessageResponse } from '../shared/messageBus';
import type { SubscriptionDetectedPayload, ValidateLicensePayload, ScheduleAlarmPayload, CancelAlarmPayload } from '../shared/messageBus';

// ─── Email Scan Retry Alarm ───────────────────────────────────────────────────

const EMAIL_SCAN_RETRY_ALARM = 'email-scan-retry';

// ─── onInstalled ─────────────────────────────────────────────────────────────

browser.runtime.onInstalled.addListener(async (details: Runtime.OnInstalledDetailsType) => {
  if (details.reason === 'install') {
    await handleInstall();
  } else if (details.reason === 'update') {
    await handleUpdate();
  }
});

async function handleInstall(): Promise<void> {
  // Mark first run timestamp
  await setSettings({ firstRunAt: new Date().toISOString() });

  // Open onboarding page (Req 12.1)
  browser.tabs.create({ url: browser.runtime.getURL('src/onboarding/index.html') });

  // Register alarms for any pre-existing subscriptions (edge case: reinstall)
  const [subscriptions, settings] = await Promise.all([
    getAllSubscriptions(),
    getSettings(),
  ]);
  await reregisterAllAlarms(subscriptions, settings);

  // Check notification permission on first install
  await checkNotificationPermission();
}

async function handleUpdate(): Promise<void> {
  // Run any pending DB migrations (Dexie handles this automatically on open,
  // but we ensure the DB is opened here to trigger migrations before use)
  try {
    await db.open();
  } catch (err) {
    console.error('[SubGuard] DB migration error on update:', err);
    // Notify user via storage flag — UI will pick this up and show a banner
    await browser.storage.local.set({ migrationError: String(err) });
  }

  // Re-register all renewal alarms (Req 18.1)
  const [subscriptions, settings] = await Promise.all([
    getAllSubscriptions(),
    getSettings(),
  ]);
  await reregisterAllAlarms(subscriptions, settings);

  // Check notification permission after update
  await checkNotificationPermission();
}

// ─── onAlarm ─────────────────────────────────────────────────────────────────

browser.alarms.onAlarm.addListener(async (alarm: Alarms.Alarm) => {
  if (alarm.name === LICENSE_REVALIDATION_ALARM) {
    await revalidateStoredLicense();
    return;
  }

  if (alarm.name === EMAIL_SCAN_RETRY_ALARM) {
    // Retry alarm fired — clear the flag so the UI knows it can retry
    await browser.storage.local.remove('emailScanRetryScheduled');
    return;
  }

  const subscriptionId = subscriptionIdFromAlarm(alarm.name);
  if (!subscriptionId) return;

  await handleRenewalAlarm(subscriptionId);
});

async function handleRenewalAlarm(subscriptionId: string): Promise<void> {
  // Read state fresh from storage (stateless SW requirement)
  const [subscriptions, settings] = await Promise.all([
    getAllSubscriptions(),
    getSettings(),
  ]);

  const subscription = subscriptions.find((s) => s.id === subscriptionId);

  // Req 5.9 — if subscription no longer exists, discard gracefully
  if (!subscription) {
    browser.alarms.clear(alarmName(subscriptionId));
    return;
  }

  // Only notify if notifications are enabled
  if (!settings.notificationsEnabled) return;

  const renewalMs = new Date(subscription.renewalDate).getTime();
  const now = Date.now();
  const daysUntilRenewal = Math.ceil((renewalMs - now) / (24 * 60 * 60 * 1000));

  // Req 23.4, 23.5 — trial-to-paid conversion prompt when renewal date has passed
  // and subscription is still in trial status
  if (subscription.status === 'trial' && renewalMs < now) {
    sendTrialConversionPrompt(
      subscription.id,
      subscription.customName ?? subscription.service,
      subscription.cost,
      subscription.currency
    );
    return;
  }

  sendRenewalNotification(
    subscription.id,
    subscription.customName ?? subscription.service,
    subscription.cost,
    subscription.currency,
    Math.max(0, daysUntilRenewal),
    subscription.status === 'trial'  // Req 23.3 — trial-specific notification text
  );
}

// ─── onMessage router ────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: Runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): true => {
    const msg = message as { type: MessageType; payload: unknown };
    handleMessage(msg.type, msg.payload)
      .then(sendResponse)
      .catch((err: unknown) =>
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    // Return true to keep the channel open for async response
    return true;
  }
);

async function handleMessage(
  type: MessageType,
  payload: unknown
): Promise<MessageResponse> {
  switch (type) {
    case 'SUBSCRIPTION_DETECTED':
      return handleSubscriptionDetected(payload as SubscriptionDetectedPayload);

    case 'VALIDATE_LICENSE':
      return handleValidateLicense(payload as ValidateLicensePayload);

    case 'REVALIDATE_LICENSE':
      await revalidateStoredLicense();
      return { success: true };

    case 'SCHEDULE_ALARM': {
      const p = payload as ScheduleAlarmPayload;
      const subscriptions = await getAllSubscriptions();
      const sub = subscriptions.find((s) => s.id === p.subscriptionId);
      if (!sub) return { success: false, error: 'Subscription not found' };
      scheduleRenewalAlarm(sub, p.reminderDaysBefore);
      return { success: true };
    }

    case 'CANCEL_ALARM': {
      const p = payload as CancelAlarmPayload;
      cancelAlarm(p.subscriptionId);
      return { success: true };
    }

    case 'GET_STATS': {
      // Stats are computed in the UI layer from IndexedDB directly;
      // SW just acknowledges the message type is known.
      return { success: true };
    }

    case 'START_EMAIL_SCAN':
      return handleStartEmailScan();

    case 'CANCEL_EMAIL_SCAN':
      return handleCancelEmailScan();

    default:
      return { success: false, error: `Unknown message type: ${String(type)}` };
  }
}

async function handleStartEmailScan(): Promise<MessageResponse> {
  try {
    const result = await runEmailScan();

    if (result.error) {
      // Check if this is a Gmail 429 rate-limit error (Req 7.9)
      const isRateLimit =
        result.error.includes('rate limit') ||
        result.error.includes('429') ||
        result.error.includes('quota');

      if (isRateLimit) {
        // Schedule a retry alarm 1 hour from now (Req 7.9)
        browser.alarms.create(EMAIL_SCAN_RETRY_ALARM, {
          delayInMinutes: 60,
        });
        await browser.storage.local.set({ emailScanRetryScheduled: true });

        return {
          success: false,
          error:
            'Gmail is temporarily rate-limited. A retry has been scheduled for 1 hour from now.',
        };
      }

      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        detected: result.detected,
        scannedCount: result.scannedCount,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Handle Gmail 429 thrown directly from the scan (Req 7.9)
    if ((err as Error & { isRateLimit?: boolean }).isRateLimit || message.includes('429')) {
      browser.alarms.create(EMAIL_SCAN_RETRY_ALARM, { delayInMinutes: 60 });
      await browser.storage.local.set({ emailScanRetryScheduled: true });

      return {
        success: false,
        error:
          'Gmail is temporarily rate-limited. A retry has been scheduled for 1 hour from now.',
      };
    }

    return { success: false, error: message };
  }
}

function handleCancelEmailScan(): MessageResponse {
  cancelEmailScan();
  return { success: true };
}

async function handleSubscriptionDetected(
  payload: SubscriptionDetectedPayload
): Promise<MessageResponse> {
  // Check for existing matching subscription (Req 6.4)
  const subscriptions = await getAllSubscriptions();
  const existing = subscriptions.find(
    (s) =>
      s.service.toLowerCase() === payload.service.toLowerCase() &&
      s.status === 'active'
  );

  if (existing) {
    return { success: true, data: { duplicate: true, existingId: existing.id } };
  }

  // Signal to the UI that a new subscription was detected and needs confirmation
  return { success: true, data: { duplicate: false, detected: payload } };
}

async function handleValidateLicense(
  payload: ValidateLicensePayload
): Promise<MessageResponse> {
  const result = await validateLicense(payload.key);
  return {
    success: result.isValid,
    data: result.license,
    error: result.error,
  };
}

// ─── onNotificationClicked ───────────────────────────────────────────────────

browser.notifications.onClicked.addListener(async (notificationId: string) => {
  // Close the notification
  browser.notifications.clear(notificationId);

  // Extract subscription ID from notification ID
  // Formats: "renewal-{subscriptionId}" or "trial-convert-{subscriptionId}"
  let subscriptionId: string | null = null;
  if (notificationId.startsWith('renewal-')) {
    subscriptionId = notificationId.slice('renewal-'.length);
  } else if (notificationId.startsWith('trial-convert-')) {
    subscriptionId = notificationId.slice('trial-convert-'.length);
  }

  // Open the Side Panel (Req 5.8)
  // Firefox Side Panel fallback: render in popup when sidePanel API unavailable (Req 15.3)
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (tab?.id) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (browser as any).sidePanel?.open({ tabId: tab.id });
    } catch {
      // Fallback: open as a new tab if sidePanel API unavailable (Firefox, Req 15.3)
      const url = subscriptionId
        ? browser.runtime.getURL(`src/sidepanel/index.html#/edit/${subscriptionId}`)
        : browser.runtime.getURL('src/sidepanel/index.html');
      browser.tabs.create({ url });
    }
  } else {
    const url = subscriptionId
      ? browser.runtime.getURL(`src/sidepanel/index.html#/edit/${subscriptionId}`)
      : browser.runtime.getURL('src/sidepanel/index.html');
    browser.tabs.create({ url });
  }
});

// ─── Startup ─────────────────────────────────────────────────────────────────

// On every SW wake, check notification permission state (Req 27.2–27.5)
checkNotificationPermission().catch((err) => {
  console.warn('[SubGuard] Startup permission check failed:', err);
});

// Check storage quota on every SW wake (Req 16.8)
checkStorageQuota().catch((err) => {
  console.warn('[SubGuard] Startup quota check failed:', err);
});
