import type { LicenseInfo } from './types';
import { getLicense, setLicense, setSettings } from './storage';
import browser from './browser';

// ─── Constants ───────────────────────────────────────────────────────────────

const LEMON_SQUEEZY_VALIDATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/validate';
const RATE_LIMIT_KEY = 'licenseRateLimit';
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const GRACE_PERIOD_DAYS = 7;
const REVALIDATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LicenseValidationResult {
  isValid: boolean;
  license?: LicenseInfo;
  error?: string;
}

interface RateLimitRecord {
  attempts: number;
  windowStart: number; // epoch ms
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

async function getRateLimitRecord(): Promise<RateLimitRecord> {
  try {
    const result = await browser.storage.local.get(RATE_LIMIT_KEY);
    return (result[RATE_LIMIT_KEY] as RateLimitRecord) ?? { attempts: 0, windowStart: Date.now() };
  } catch {
    return { attempts: 0, windowStart: Date.now() };
  }
}

async function checkAndIncrementRateLimit(): Promise<boolean> {
  const record = await getRateLimitRecord();
  const now = Date.now();

  // Reset window if expired
  if (now - record.windowStart >= RATE_LIMIT_WINDOW_MS) {
    const fresh: RateLimitRecord = { attempts: 1, windowStart: now };
    await browser.storage.local.set({ [RATE_LIMIT_KEY]: fresh });
    return true;
  }

  if (record.attempts >= RATE_LIMIT_MAX) {
    return false; // Rate limit exceeded
  }

  const updated: RateLimitRecord = { ...record, attempts: record.attempts + 1 };
  await browser.storage.local.set({ [RATE_LIMIT_KEY]: updated });
  return true;
}

// ─── Fetch with Exponential Backoff ──────────────────────────────────────────

async function fetchWithBackoff(
  url: string,
  options: RequestInit,
  retries = 3,
  delays = [1000, 2000, 4000]
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      // Only retry on 5xx or network errors
      if (response.status >= 500 && attempt < retries) {
        await sleep(delays[attempt] ?? delays[delays.length - 1]);
        continue;
      }
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await sleep(delays[attempt] ?? delays[delays.length - 1]);
      }
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── validateLicense ─────────────────────────────────────────────────────────

/**
 * Validate a Lemon Squeezy license key.
 * Enforces rate limiting (5 attempts/hour).
 * Retries up to 3 times with exponential backoff on 5xx/network errors.
 */
export async function validateLicense(key: string): Promise<LicenseValidationResult> {
  const allowed = await checkAndIncrementRateLimit();
  if (!allowed) {
    return { isValid: false, error: 'Rate limit exceeded. Please try again later.' };
  }

  let response: Response;
  try {
    response = await fetchWithBackoff(
      LEMON_SQUEEZY_VALIDATE_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ license_key: key }),
      }
    );
  } catch {
    return { isValid: false, error: 'Unable to reach the license server. Check your connection.' };
  }

  if (!response.ok) {
    // 4xx — non-retryable, invalid key
    return { isValid: false, error: 'Invalid or expired license key.' };
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    return { isValid: false, error: 'Unexpected response from license server.' };
  }

  const meta = data.meta as Record<string, unknown> | undefined;
  const licenseKeyData = data.license_key as Record<string, unknown> | undefined;

  if (!meta?.store_id || licenseKeyData?.status === 'inactive' || licenseKeyData?.status === 'expired') {
    return { isValid: false, error: 'License is inactive or expired.' };
  }

  const license: LicenseInfo = {
    key,
    type: (licenseKeyData?.expires_at == null ? 'lifetime' : 'monthly') as 'monthly' | 'lifetime',
    validatedAt: new Date().toISOString(),
    expiresAt: licenseKeyData?.expires_at as string | undefined,
    email: (meta?.customer_email as string) ?? '',
    isValid: true,
    lastRevalidationAttempt: new Date().toISOString(),
  };

  await setLicense(license);
  await setSettings({ proLicense: true });

  return { isValid: true, license };
}

// ─── revalidateStoredLicense ─────────────────────────────────────────────────

/**
 * Re-validate the stored license key (called by the daily alarm).
 * - If API is unreachable, preserve Pro status for up to 7 days (grace period).
 * - If grace period expires, downgrade to free tier.
 * - If license is revoked (4xx), immediately revoke Pro access.
 */
export async function revalidateStoredLicense(): Promise<void> {
  const license = await getLicense();
  if (!license || !license.isValid) return;

  // Skip if revalidated within the last 24 hours
  if (license.lastRevalidationAttempt) {
    const lastAttempt = new Date(license.lastRevalidationAttempt).getTime();
    if (Date.now() - lastAttempt < REVALIDATION_INTERVAL_MS) return;
  }

  const now = new Date().toISOString();

  let response: Response;
  try {
    response = await fetchWithBackoff(
      LEMON_SQUEEZY_VALIDATE_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ license_key: license.key }),
      }
    );
  } catch {
    // API unreachable — apply grace period logic
    await handleRevalidationFailure(license, now);
    return;
  }

  if (!response.ok) {
    // 4xx — license revoked; immediately downgrade
    await revokeLicense();
    return;
  }

  // Successful revalidation — clear grace period, update timestamp
  const updated: LicenseInfo = {
    ...license,
    isValid: true,
    lastRevalidationAttempt: now,
    gracePeriodStart: undefined,
  };
  await setLicense(updated);
}

async function handleRevalidationFailure(license: LicenseInfo, now: string): Promise<void> {
  const gracePeriodStart = license.gracePeriodStart ?? now;
  const gracePeriodMs = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  const gracePeriodExpired =
    Date.now() - new Date(gracePeriodStart).getTime() > gracePeriodMs;

  if (gracePeriodExpired) {
    await revokeLicense();
  } else {
    // Preserve Pro status, record grace period start
    const updated: LicenseInfo = {
      ...license,
      lastRevalidationAttempt: now,
      gracePeriodStart,
    };
    await setLicense(updated);
  }
}

async function revokeLicense(): Promise<void> {
  await setLicense(null);
  await setSettings({ proLicense: false });
}
