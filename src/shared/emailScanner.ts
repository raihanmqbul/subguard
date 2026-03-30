/**
 * SubGuard Email Scanner — Pro Feature
 *
 * Scans Gmail inbox for subscription receipts/invoices via OAuth.
 * - Uses chrome.identity.getAuthToken (never persists the token)
 * - Rate-limited to 1 scan per 24 hours
 * - Supports cancellation mid-scan
 * Requirements: 7.1–7.8
 */

import type { Subscription, BillingCycle, Currency } from './types';
import { SERVICE_CATALOG } from './constants';
import browser from './browser';

// ─── Constants ───────────────────────────────────────────────────────────────

const SCAN_RATE_LIMIT_KEY = 'emailScanLastRun';
const SCAN_RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

const GMAIL_SEARCH_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const GMAIL_MESSAGE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';

/** Gmail search query to find receipt/invoice emails */
const RECEIPT_QUERY =
  'subject:(receipt OR invoice OR "subscription confirmation" OR "billing confirmation" OR "payment confirmation" OR "order confirmation") newer_than:365d';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DetectedSubscription {
  service: string;
  cost?: number;
  currency?: Currency;
  billingCycle?: BillingCycle;
  renewalDate?: string;
  detectedFrom: 'email';
  sourceEmailId: string;
}

export interface EmailScanResult {
  detected: DetectedSubscription[];
  scannedCount: number;
  error?: string;
}

export interface ScanProgress {
  scanned: number;
  total: number;
  cancelled: boolean;
}

// ─── Cancellation Token ──────────────────────────────────────────────────────

let _cancelRequested = false;

/** Request cancellation of an in-progress scan. */
export function cancelEmailScan(): void {
  _cancelRequested = true;
}

/** Reset cancellation flag (called at scan start). */
function resetCancel(): void {
  _cancelRequested = false;
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────

async function getLastScanTime(): Promise<number | null> {
  try {
    const result = await browser.storage.local.get(SCAN_RATE_LIMIT_KEY);
    return (result[SCAN_RATE_LIMIT_KEY] as number) ?? null;
  } catch {
    return null;
  }
}

async function recordScanTime(): Promise<void> {
  await browser.storage.local.set({ [SCAN_RATE_LIMIT_KEY]: Date.now() });
}

export async function canRunScan(): Promise<boolean> {
  const last = await getLastScanTime();
  if (last === null) return true;
  return Date.now() - last >= SCAN_RATE_LIMIT_MS;
}

export async function getNextScanAllowedAt(): Promise<Date | null> {
  const last = await getLastScanTime();
  if (last === null) return null;
  const next = last + SCAN_RATE_LIMIT_MS;
  if (Date.now() >= next) return null;
  return new Date(next);
}

// ─── OAuth Token ─────────────────────────────────────────────────────────────

/**
 * Obtain a Gmail OAuth token via chrome.identity.
 * Token is NEVER stored — used in-memory only (Req 7.5, 20.5).
 */
async function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (browser as any).identity.getAuthToken({ interactive: true }, (result: string | { token?: string }) => {
      if (browser.runtime.lastError) {
        reject(new Error(browser.runtime.lastError.message ?? 'OAuth flow failed or was denied'));
        return;
      }
      const token = typeof result === 'string' ? result : (result as { token?: string })?.token;
      if (!token) {
        reject(new Error('OAuth flow failed or was denied'));
        return;
      }
      resolve(token);
    });
  });
}

/**
 * Revoke and discard the OAuth token after use (Req 7.5).
 */
async function discardToken(token: string): Promise<void> {
  try {
    // Revoke from Google's servers
    await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
  } catch {
    // Best-effort revocation; don't throw
  }
  // Remove from browser's token cache
  await new Promise<void>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (browser as any).identity.removeCachedAuthToken({ token }, resolve);
  });
}

// ─── Gmail API Helpers ───────────────────────────────────────────────────────

interface GmailMessageListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailMessagePart {
  mimeType: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
  headers?: Array<{ name: string; value: string }>;
}

interface GmailMessage {
  id: string;
  payload?: GmailMessagePart;
  snippet?: string;
}

async function gmailFetch<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 429) {
    const err = new Error('Gmail API rate limit exceeded');
    (err as Error & { isRateLimit: boolean }).isRateLimit = true;
    throw err;
  }

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/** Fetch list of message IDs matching the receipt query (max 100). */
async function fetchMessageIds(token: string): Promise<string[]> {
  const params = new URLSearchParams({
    q: RECEIPT_QUERY,
    maxResults: '100',
    fields: 'messages/id,nextPageToken',
  });

  const data = await gmailFetch<GmailMessageListResponse>(
    `${GMAIL_SEARCH_URL}?${params.toString()}`,
    token
  );

  return (data.messages ?? []).map((m) => m.id);
}

/** Fetch a single message by ID (metadata + snippet only for performance). */
async function fetchMessage(id: string, token: string): Promise<GmailMessage> {
  const params = new URLSearchParams({ format: 'full', fields: 'id,payload,snippet' });
  return gmailFetch<GmailMessage>(
    `${GMAIL_MESSAGE_URL}/${id}?${params.toString()}`,
    token
  );
}

// ─── Email Parsing ───────────────────────────────────────────────────────────

const AMOUNT_PATTERN = /(?:USD|EUR|GBP|PKR|INR|CAD|AUD)?\s*\$?\s*([\d,]+\.?\d{0,2})\s*(?:USD|EUR|GBP|PKR|INR|CAD|AUD)?/i;
const CURRENCY_PATTERN = /\b(USD|EUR|GBP|PKR|INR|CAD|AUD)\b/i;
const BILLING_CYCLE_PATTERN = /\b(monthly|annually|yearly|weekly|quarterly|per month|per year|\/month|\/year|\/mo|\/yr)\b/i;
const DATE_PATTERN =
  /(?:next billing|renews?(?:\s+on)?|renewal date|next charge|billed on|due on)[:\s]+([A-Za-z]+ \d{1,2},?\s*\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;

const BILLING_CYCLE_MAP: Record<string, BillingCycle> = {
  monthly: 'monthly',
  'per month': 'monthly',
  '/month': 'monthly',
  '/mo': 'monthly',
  annually: 'yearly',
  yearly: 'yearly',
  'per year': 'yearly',
  '/year': 'yearly',
  '/yr': 'yearly',
  weekly: 'weekly',
  quarterly: 'quarterly',
};

const CURRENCY_MAP: Record<string, Currency> = {
  usd: 'USD',
  eur: 'EUR',
  gbp: 'GBP',
  pkr: 'PKR',
  inr: 'INR',
  cad: 'CAD',
  aud: 'AUD',
};

function extractTextFromPayload(part: GmailMessagePart): string {
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  if (part.mimeType === 'text/html' && part.body?.data) {
    const html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    // Strip HTML tags for plain text extraction
    return html.replace(/<[^>]+>/g, ' ');
  }
  if (part.parts) {
    return part.parts.map(extractTextFromPayload).join(' ');
  }
  return '';
}

function getHeader(part: GmailMessagePart, name: string): string {
  return part.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function matchServiceFromText(text: string, subject: string, from: string): string | null {
  const combined = `${subject} ${from} ${text}`.toLowerCase();

  for (const entry of SERVICE_CATALOG) {
    // Check service name
    if (combined.includes(entry.name.toLowerCase())) return entry.name;
    // Check domains
    for (const domain of entry.domains) {
      const domainBase = domain.replace(/^www\./, '');
      if (combined.includes(domainBase)) return entry.name;
    }
  }

  // Fallback: extract sender domain as service name
  const fromMatch = from.match(/@([\w.-]+)/);
  if (fromMatch) {
    const domain = fromMatch[1].replace(/\.(com|net|org|io|co)$/, '');
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }

  return null;
}

function parseEmailForSubscription(
  message: GmailMessage
): DetectedSubscription | null {
  const payload = message.payload;
  if (!payload) return null;

  const subject = getHeader(payload, 'subject');
  const from = getHeader(payload, 'from');
  const text = extractTextFromPayload(payload) || message.snippet || '';
  const combined = `${subject} ${text}`;

  const service = matchServiceFromText(text, subject, from);
  if (!service) return null;

  // Extract cost
  const amountMatch = combined.match(AMOUNT_PATTERN);
  const cost = amountMatch
    ? parseFloat(amountMatch[1].replace(/,/g, ''))
    : undefined;

  // Extract currency
  const currencyMatch = combined.match(CURRENCY_PATTERN);
  const currency = currencyMatch
    ? (CURRENCY_MAP[currencyMatch[1].toLowerCase()] ?? 'USD')
    : 'USD';

  // Extract billing cycle
  const cycleMatch = combined.match(BILLING_CYCLE_PATTERN);
  const billingCycle = cycleMatch
    ? (BILLING_CYCLE_MAP[cycleMatch[1].toLowerCase()] ?? 'monthly')
    : undefined;

  // Extract renewal date
  const dateMatch = combined.match(DATE_PATTERN);
  let renewalDate: string | undefined;
  if (dateMatch) {
    const parsed = new Date(dateMatch[1]);
    if (!isNaN(parsed.getTime())) {
      renewalDate = parsed.toISOString().split('T')[0];
    }
  }

  return {
    service,
    cost,
    currency,
    billingCycle,
    renewalDate,
    detectedFrom: 'email',
    sourceEmailId: message.id,
  };
}

// ─── Main Scan Function ──────────────────────────────────────────────────────

/**
 * Run a Gmail inbox scan for subscription receipts.
 *
 * - Checks rate limit (1 scan per 24 hours) — Req 7.8
 * - Obtains OAuth token interactively — Req 7.2
 * - Discards token after use — Req 7.5
 * - Supports cancellation — Req 7.7
 * - Handles Gmail 429 by throwing a rate-limit error — Req 7.9
 *
 * @param onProgress Optional callback for scan progress updates
 */
export async function runEmailScan(
  onProgress?: (progress: ScanProgress) => void
): Promise<EmailScanResult> {
  resetCancel();

  // Rate limit check (Req 7.8)
  const allowed = await canRunScan();
  if (!allowed) {
    const nextAllowed = await getNextScanAllowedAt();
    const timeStr = nextAllowed
      ? nextAllowed.toLocaleTimeString()
      : 'later';
    return {
      detected: [],
      scannedCount: 0,
      error: `Email scan is limited to once per 24 hours. Next scan available at ${timeStr}.`,
    };
  }

  let token: string | null = null;

  try {
    // Obtain OAuth token (Req 7.2) — never stored
    token = await getAuthToken();
  } catch (err) {
    // OAuth denied or failed (Req 7.6)
    return {
      detected: [],
      scannedCount: 0,
      error: err instanceof Error ? err.message : 'Gmail authorization failed.',
    };
  }

  const detected: DetectedSubscription[] = [];
  let scannedCount = 0;

  try {
    // Fetch message IDs
    const messageIds = await fetchMessageIds(token);
    const total = messageIds.length;

    onProgress?.({ scanned: 0, total, cancelled: false });

    for (const id of messageIds) {
      // Check cancellation (Req 7.7)
      if (_cancelRequested) {
        onProgress?.({ scanned: scannedCount, total, cancelled: true });
        return { detected, scannedCount, error: 'Scan cancelled by user.' };
      }

      try {
        const message = await fetchMessage(id, token);
        const result = parseEmailForSubscription(message);
        if (result) {
          // Deduplicate by service name
          const alreadyFound = detected.some(
            (d) => d.service.toLowerCase() === result.service.toLowerCase()
          );
          if (!alreadyFound) {
            detected.push(result);
          }
        }
      } catch (err) {
        // Re-throw rate limit errors (Req 7.9)
        if ((err as Error & { isRateLimit?: boolean }).isRateLimit) {
          throw err;
        }
        // Skip individual message errors silently
        console.warn('[SubGuard] Failed to parse email:', id, err);
      }

      scannedCount++;
      onProgress?.({ scanned: scannedCount, total, cancelled: false });
    }

    // Record successful scan time for rate limiting
    await recordScanTime();

    return { detected, scannedCount };
  } finally {
    // Always discard token after use (Req 7.5, 20.5)
    if (token) {
      await discardToken(token);
    }
  }
}

// ─── Helpers for UI ──────────────────────────────────────────────────────────

/**
 * Convert a DetectedSubscription to a partial Subscription for the add form.
 */
export function detectedToPartialSubscription(
  detected: DetectedSubscription
): Partial<Subscription> {
  const catalogEntry = SERVICE_CATALOG.find(
    (e) => e.name.toLowerCase() === detected.service.toLowerCase()
  );

  return {
    service: detected.service,
    cost: detected.cost ?? 0,
    currency: detected.currency ?? 'USD',
    billingCycle: detected.billingCycle ?? 'monthly',
    renewalDate: detected.renewalDate ?? new Date().toISOString().split('T')[0],
    category: catalogEntry?.defaultCategory ?? 'other',
    cancelUrl: catalogEntry?.defaultCancelUrl,
    detectedFrom: 'email',
    status: 'active',
  };
}
