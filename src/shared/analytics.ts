/**
 * Opt-in analytics module for SubGuard.
 *
 * Uses Plausible's lightweight event API. Events are only fired when the user
 * has explicitly opted in via Settings (analyticsOptIn: true).
 *
 * Requirements: 30.1, 30.2, 30.3, 30.4, 30.5
 *
 * Privacy guarantees:
 * - No PII, subscription names, costs, or email addresses in any payload.
 * - No network requests when analytics are disabled.
 * - All payloads are anonymized and contain only event type metadata.
 */

import { getSettings } from './storage';
import browser from './browser';

// ─── Event Types ─────────────────────────────────────────────────────────────

export type AnalyticsEventName =
  | 'subscription_added'
  | 'subscription_deleted'
  | 'pro_upgrade_initiated'
  | 'email_scan_completed';

/**
 * Anonymized event payload — no PII, no subscription-specific data (Req 30.4).
 */
export interface AnalyticsEventProps {
  /** Billing cycle type, e.g. 'monthly' — no cost or name included */
  billingCycle?: string;
  /** Category of the subscription, e.g. 'streaming' — no service name */
  category?: string;
  /** Whether the email scan found any results */
  foundSubscriptions?: boolean;
  /** Upgrade plan type: 'monthly' | 'lifetime' */
  planType?: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Plausible analytics endpoint. Plausible is privacy-respecting and
 * GDPR-compliant by design (no cookies, no cross-site tracking).
 * Replace PLAUSIBLE_DOMAIN with the registered domain in Plausible dashboard.
 */
const PLAUSIBLE_ENDPOINT = 'https://plausible.io/api/event';
const PLAUSIBLE_DOMAIN = 'subguard.extension';

// ─── Core Track Function ──────────────────────────────────────────────────────

/**
 * Tracks an anonymized analytics event.
 *
 * Checks analyticsOptIn before making any network request (Req 30.2, 30.5).
 * Silently no-ops when opt-in is false or on any network error.
 */
export async function trackEvent(
  name: AnalyticsEventName,
  props?: AnalyticsEventProps
): Promise<void> {
  try {
    const settings = await getSettings();

    // Req 30.2: Do not collect any data until user explicitly opts in.
    // Req 30.5: No network requests when analytics are disabled.
    if (!settings.analyticsOptIn) {
      return;
    }

    // Build a minimal, anonymized payload — no PII (Req 30.4).
    const payload = {
      name,
      url: `chrome-extension://${browser.runtime.id}/`,
      domain: PLAUSIBLE_DOMAIN,
      // Only include props if provided and non-empty
      ...(props && Object.keys(props).length > 0 ? { props } : {}),
    };

    // Fire-and-forget: analytics failures must never affect core functionality.
    await fetch(PLAUSIBLE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silently swallow all errors — analytics must never break the extension.
  }
}

// ─── Convenience Helpers ──────────────────────────────────────────────────────

/** Req 30.3: Track when a subscription is added (no name/cost in payload). */
export function trackSubscriptionAdded(props?: Pick<AnalyticsEventProps, 'billingCycle' | 'category'>): Promise<void> {
  return trackEvent('subscription_added', props);
}

/** Req 30.3: Track when a subscription is deleted. */
export function trackSubscriptionDeleted(props?: Pick<AnalyticsEventProps, 'billingCycle' | 'category'>): Promise<void> {
  return trackEvent('subscription_deleted', props);
}

/** Req 30.3: Track when a user initiates the Pro upgrade flow. */
export function trackProUpgradeInitiated(props?: Pick<AnalyticsEventProps, 'planType'>): Promise<void> {
  return trackEvent('pro_upgrade_initiated', props);
}

/** Req 30.3: Track when an email scan completes. */
export function trackEmailScanCompleted(props?: Pick<AnalyticsEventProps, 'foundSubscriptions'>): Promise<void> {
  return trackEvent('email_scan_completed', props);
}
