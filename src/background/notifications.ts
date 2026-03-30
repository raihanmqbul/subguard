import { getSettings, setSettings } from '../shared/storage';
import browser from '../shared/browser';

/**
 * Check the current notification permission level and sync it with stored settings.
 * If permission was revoked externally, updates `notificationsEnabled` to false.
 * Called on Service Worker startup (Req 5.6, 5.7, 27.2–27.5).
 *
 * Note: `getPermissionLevel` is Chrome-only and not in webextension-polyfill.
 * We access it via the `chrome` global directly.
 */
export async function checkNotificationPermission(): Promise<void> {
  // Use chrome global directly — getPermissionLevel is not in the polyfill
  const chromeNotifications = (globalThis as { chrome?: { notifications?: { getPermissionLevel?: (cb: (level: string) => void) => void } } }).chrome?.notifications;

  if (!chromeNotifications?.getPermissionLevel) {
    // Firefox / environments without this API — skip check
    return;
  }

  return new Promise((resolve) => {
    chromeNotifications.getPermissionLevel!(async (level: string) => {
      const settings = await getSettings();

      if (level !== 'granted' && settings.notificationsEnabled) {
        // Permission was revoked externally — disable in settings
        await setSettings({ notificationsEnabled: false });
        console.warn('[SubGuard] Notification permission revoked externally; disabling notifications.');
      }

      resolve();
    });
  });
}

/**
 * Request notification permission from the user.
 * Returns true if permission was granted.
 * Called when the user enables the notifications toggle in Settings.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const chromeNotifications = (globalThis as { chrome?: { notifications?: { getPermissionLevel?: (cb: (level: string) => void) => void } } }).chrome?.notifications;

  if (!chromeNotifications?.getPermissionLevel) {
    // Firefox — assume granted if notifications API is available
    await setSettings({ notificationsEnabled: true });
    return true;
  }

  return new Promise((resolve) => {
    chromeNotifications.getPermissionLevel!(async (level: string) => {
      if (level === 'granted') {
        await setSettings({ notificationsEnabled: true });
        resolve(true);
      } else {
        await setSettings({ notificationsEnabled: false });
        resolve(false);
      }
    });
  });
}

/**
 * Send a renewal reminder notification for a subscription.
 * Uses trial-specific messaging when the subscription is in trial status (Req 23.3).
 */
export function sendRenewalNotification(
  subscriptionId: string,
  serviceName: string,
  cost: number,
  currency: string,
  daysUntilRenewal: number,
  isTrial = false
): void {
  const dayLabel = daysUntilRenewal === 0
    ? 'today'
    : daysUntilRenewal === 1
    ? 'tomorrow'
    : `in ${daysUntilRenewal} day${daysUntilRenewal !== 1 ? 's' : ''}`;

  const title = isTrial
    ? 'SubGuard — Trial Ending Soon'
    : 'SubGuard — Upcoming Renewal';

  const message = isTrial
    ? `Your ${serviceName} trial ends ${dayLabel}. You'll be charged ${currency} ${cost.toFixed(2)} unless you cancel.`
    : `${serviceName} renews ${dayLabel} — ${currency} ${cost.toFixed(2)}`;

  browser.notifications.create(`renewal-${subscriptionId}`, {
    type: 'basic',
    iconUrl: 'public/icons/icon-48.png',
    title,
    message,
    priority: 1,
  });
}

/**
 * Send a trial-to-paid conversion prompt notification (Req 23.4, 23.5).
 * Fired when a trial subscription's renewal date has passed without a status change.
 */
export function sendTrialConversionPrompt(
  subscriptionId: string,
  serviceName: string,
  cost: number,
  currency: string
): void {
  browser.notifications.create(`trial-convert-${subscriptionId}`, {
    type: 'basic',
    iconUrl: 'public/icons/icon-48.png',
    title: 'SubGuard — Trial Converted?',
    message: `Your ${serviceName} trial may have converted to a paid plan (${currency} ${cost.toFixed(2)}). Update its status in SubGuard.`,
    priority: 2,
  });
}
