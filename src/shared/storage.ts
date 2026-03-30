import type { UserSettings, LicenseInfo } from './types';
import { DEFAULT_SETTINGS } from './constants';
import browser from './browser';

const SETTINGS_KEY = 'settings';
const LICENSE_KEY = 'license';

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<UserSettings> {
  try {
    const result = await browser.storage.local.get(SETTINGS_KEY);
    if (result[SETTINGS_KEY]) {
      return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] } as UserSettings;
    }
    return { ...DEFAULT_SETTINGS };
  } catch (err) {
    console.warn('[SubGuard] Failed to read settings from storage, using defaults:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function setSettings(partial: Partial<UserSettings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await browser.storage.local.set({ [SETTINGS_KEY]: updated });
}

// ─── License ─────────────────────────────────────────────────────────────────

export async function getLicense(): Promise<LicenseInfo | null> {
  try {
    const result = await browser.storage.local.get(LICENSE_KEY);
    return (result[LICENSE_KEY] as LicenseInfo) ?? null;
  } catch (err) {
    console.warn('[SubGuard] Failed to read license from storage:', err);
    return null;
  }
}

export async function setLicense(license: LicenseInfo | null): Promise<void> {
  if (license === null) {
    await browser.storage.local.remove(LICENSE_KEY);
  } else {
    await browser.storage.local.set({ [LICENSE_KEY]: license });
  }
}

// ─── Quota Monitoring ─────────────────────────────────────────────────────────

const QUOTA_BYTES = 10 * 1024 * 1024; // 10MB (chrome.storage.local limit)
const QUOTA_WARN_THRESHOLD = 0.8;      // 80%
const QUOTA_WARNING_KEY = 'storageQuotaWarning';

/**
 * Checks chrome.storage.local usage and sets a warning flag when usage
 * exceeds 80% of the 10MB quota (Req 16.8).
 * Returns true if the warning threshold is exceeded.
 */
export async function checkStorageQuota(): Promise<boolean> {
  try {
    const bytesInUse = await browser.storage.local.getBytesInUse(null);
    const ratio = bytesInUse / QUOTA_BYTES;
    if (ratio >= QUOTA_WARN_THRESHOLD) {
      await browser.storage.local.set({ [QUOTA_WARNING_KEY]: true });
      return true;
    } else {
      await browser.storage.local.remove(QUOTA_WARNING_KEY);
      return false;
    }
  } catch (err) {
    console.warn('[SubGuard] Failed to check storage quota:', err);
    return false;
  }
}

/**
 * Reads and clears the quota warning flag set by checkStorageQuota().
 * Returns true if a warning was pending.
 */
export async function consumeStorageQuotaWarning(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get(QUOTA_WARNING_KEY);
    if (result[QUOTA_WARNING_KEY]) {
      await browser.storage.local.remove(QUOTA_WARNING_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
