import type { Subscription, UserSettings } from '../shared/types';
import browser from '../shared/browser';

// Alarm name prefix for renewal reminders
const RENEWAL_ALARM_PREFIX = 'renewal:';
export const LICENSE_REVALIDATION_ALARM = 'license-revalidation';

/**
 * Returns the alarm name for a given subscription ID.
 */
export function alarmName(subscriptionId: string): string {
  return `${RENEWAL_ALARM_PREFIX}${subscriptionId}`;
}

/**
 * Returns the subscription ID from an alarm name, or null if not a renewal alarm.
 */
export function subscriptionIdFromAlarm(name: string): string | null {
  if (!name.startsWith(RENEWAL_ALARM_PREFIX)) return null;
  return name.slice(RENEWAL_ALARM_PREFIX.length);
}

/**
 * Schedule a renewal reminder alarm for a subscription.
 * The alarm fires `reminderDays` days before the renewal date.
 * If the computed fire time is in the past, no alarm is scheduled.
 */
export function scheduleRenewalAlarm(
  subscription: Subscription,
  reminderDays: number
): void {
  const renewalMs = new Date(subscription.renewalDate).getTime();
  const fireMs = renewalMs - reminderDays * 24 * 60 * 60 * 1000;

  if (fireMs <= Date.now()) {
    // Renewal is too soon or already past — skip
    return;
  }

  browser.alarms.create(alarmName(subscription.id), { when: fireMs });
}

/**
 * Cancel the renewal alarm for a subscription.
 */
export function cancelAlarm(subscriptionId: string): void {
  browser.alarms.clear(alarmName(subscriptionId));
}

/**
 * Re-register renewal alarms for all active/trial subscriptions.
 * Clears any existing renewal alarms first to avoid duplicates.
 */
export async function reregisterAllAlarms(
  subscriptions: Subscription[],
  settings: UserSettings
): Promise<void> {
  // Clear all existing renewal alarms
  const existing = await browser.alarms.getAll();
  for (const alarm of existing) {
    if (alarm.name.startsWith(RENEWAL_ALARM_PREFIX)) {
      browser.alarms.clear(alarm.name);
    }
  }

  // Re-register for active and trial subscriptions only
  for (const sub of subscriptions) {
    if (sub.status === 'active' || sub.status === 'trial') {
      scheduleRenewalAlarm(sub, settings.reminderDaysBefore);
    }
  }

  // Ensure the daily license re-validation alarm exists
  const licenseAlarm = await browser.alarms.get(LICENSE_REVALIDATION_ALARM);
  if (!licenseAlarm) {
    browser.alarms.create(LICENSE_REVALIDATION_ALARM, {
      delayInMinutes: 24 * 60,
      periodInMinutes: 24 * 60,
    });
  }
}
