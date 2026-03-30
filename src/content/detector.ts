/**
 * SubGuard Content Script — Subscription Detector
 *
 * Runs at document_idle on known service domains only (Req 6.2).
 * Extracts subscription data from the page DOM and sends it to the
 * Service Worker for dedup-checking and user confirmation (Req 6.3).
 *
 * Design constraints:
 * - Must complete within 100ms (Req 19.5)
 * - All DOM access wrapped in try/catch (Req 6.7)
 * - Session-level dismissed set prevents re-prompting (Req 6.6)
 * - Respects autoDetectEnabled setting (Req 6.8)
 * - Records detectedFrom domain on detected subscriptions (Req 6.9)
 */

import { SERVICE_CATALOG } from '../shared/constants';
import { sendMessage } from '../shared/messageBus';
import browser from '../shared/browser';
import type { BillingCycle } from '../shared/types';

// ─── Session-level dismissed services (Req 6.6) ──────────────────────────────

const dismissedServices = new Set<string>();

// ─── Detection patterns (from design doc) ────────────────────────────────────

const DETECTION_PATTERNS = {
  amount: /\$[\d,]+\.?\d{0,2}|\d+\.?\d{0,2}\s*(USD|EUR|GBP)/i,
  date: /(?:next billing|renews on|renewal date)[:\s]+([A-Za-z]+ \d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i,
  cycle: /\b(monthly|annually|yearly|weekly|quarterly)\b/i,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize hostname to bare domain (strip www. prefix) */
function normalizeDomain(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

/** Find the catalog entry whose domains include the current hostname */
function findCatalogEntryForDomain(hostname: string): { key: string; name: string } | null {
  const normalized = normalizeDomain(hostname);
  for (const entry of SERVICE_CATALOG) {
    for (const domain of entry.domains) {
      if (normalized === domain || normalized.endsWith(`.${domain}`)) {
        return { key: entry.key, name: entry.name };
      }
    }
  }
  return null;
}

/** Parse a raw amount string into a number */
function parseAmount(raw: string): number | undefined {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? undefined : value;
}

/** Normalize billing cycle string to BillingCycle type */
function normalizeCycle(raw: string): BillingCycle {
  const lower = raw.toLowerCase();
  if (lower === 'annually' || lower === 'yearly') return 'yearly';
  if (lower === 'weekly') return 'weekly';
  if (lower === 'quarterly') return 'quarterly';
  return 'monthly';
}

/** Parse a date string into ISO 8601 format */
function parseDate(raw: string): string | undefined {
  try {
    const date = new Date(raw.trim());
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // ignore parse errors
  }
  return undefined;
}

// ─── DOM extraction ───────────────────────────────────────────────────────────

interface DetectedData {
  cost?: number;
  billingCycle?: BillingCycle;
  renewalDate?: string;
}

function extractFromDOM(): DetectedData {
  const result: DetectedData = {};

  try {
    // Search visible text content for patterns
    const bodyText = document.body?.innerText ?? '';

    // Extract amount
    const amountMatch = DETECTION_PATTERNS.amount.exec(bodyText);
    if (amountMatch) {
      result.cost = parseAmount(amountMatch[0]);
    }

    // Extract renewal date
    const dateMatch = DETECTION_PATTERNS.date.exec(bodyText);
    if (dateMatch?.[1]) {
      result.renewalDate = parseDate(dateMatch[1]);
    }

    // Extract billing cycle
    const cycleMatch = DETECTION_PATTERNS.cycle.exec(bodyText);
    if (cycleMatch?.[1]) {
      result.billingCycle = normalizeCycle(cycleMatch[1]);
    }
  } catch (err) {
    // Req 6.7 — log and exit gracefully; do not affect page functionality
    console.warn('[SubGuard] DOM extraction error:', err);
  }

  return result;
}

// ─── Main detection logic ─────────────────────────────────────────────────────

async function runDetection(): Promise<void> {
  const startTime = performance.now();

  try {
    // Req 6.2 — domain guard: only run on known catalog domains
    const hostname = window.location.hostname;
    const catalogEntry = findCatalogEntryForDomain(hostname);
    if (!catalogEntry) return;

    // Req 6.6 — skip if this service was dismissed this session
    if (dismissedServices.has(catalogEntry.key)) return;

    // Req 6.8 — check autoDetectEnabled setting before sending
    let autoDetectEnabled = true;
    try {
      const stored = await browser.storage.local.get('settings');
      const settings = stored?.settings as { autoDetectEnabled?: boolean } | undefined;
      if (settings?.autoDetectEnabled === false) {
        autoDetectEnabled = false;
      }
    } catch {
      // If we can't read settings, default to enabled
    }

    if (!autoDetectEnabled) return;

    // Req 19.5 — bail out if we've already spent too long
    if (performance.now() - startTime > 80) return;

    // Extract subscription data from DOM
    const detected = extractFromDOM();

    // Req 19.5 — check time budget again after DOM extraction
    if (performance.now() - startTime > 95) return;

    // Req 6.3 — send detected data to Service Worker
    try {
      await sendMessage('SUBSCRIPTION_DETECTED', {
        service: catalogEntry.name,
        cost: detected.cost,
        currency: 'USD', // default; content script can't reliably determine currency
        billingCycle: detected.billingCycle,
        renewalDate: detected.renewalDate,
        detectedFrom: hostname, // Req 6.9
      });
    } catch (err) {
      // Service Worker may not be available; log and continue
      console.warn('[SubGuard] Failed to send detection message:', err);
    }
  } catch (err) {
    // Req 6.7 — top-level catch; never throw from content script
    console.warn('[SubGuard] Detection error:', err);
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

// Req 19.5 — use requestIdleCallback if available to avoid blocking page load
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => { runDetection(); }, { timeout: 100 });
} else {
  // Fallback: run asynchronously via setTimeout to yield to the page
  setTimeout(() => { runDetection(); }, 0);
}

// ─── Pro: Highlight cancel button (Req 8.4) ───────────────────────────────────

browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as { type?: string; payload?: { cancelUrl?: string } };
  if (msg?.type !== 'HIGHLIGHT_CANCEL_BUTTON') return;
  try {
    const cancelUrl: string = msg?.payload?.cancelUrl ?? '';
    if (!cancelUrl) return;
    const { pathname } = new URL(cancelUrl);
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
    const target = anchors.find((a) => a.pathname === pathname || a.href === cancelUrl);
    if (target) {
      target.style.outline = '3px solid #6366f1';
      target.style.outlineOffset = '2px';
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (err) {
    console.warn('[SubGuard] Highlight cancel button error:', err);
  }
});

// ─── Exports (for testing) ────────────────────────────────────────────────────

export {
  findCatalogEntryForDomain,
  extractFromDOM,
  normalizeCycle,
  parseAmount,
  parseDate,
  dismissedServices,
  runDetection,
};
