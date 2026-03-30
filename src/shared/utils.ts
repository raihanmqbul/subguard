import type {
  Subscription,
  UserSettings,
  SpendStats,
  BillingCycle,
  Currency,
  Category,
  UpcomingRenewal,
} from './types';
import { EXCHANGE_RATES_USD_BASE, ALL_CATEGORIES } from './constants';

// ─── Currency Conversion ─────────────────────────────────────────────────────

/**
 * Convert an amount from one currency to another using USD-base exchange rates.
 * Returns the converted amount rounded to 2 decimal places.
 */
export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
  rates: Record<Currency, number> = EXCHANGE_RATES_USD_BASE,
): number {
  if (from === to) return amount;
  // Convert to USD first, then to target currency
  const usd = amount / rates[from];
  return Math.round(usd * rates[to] * 100) / 100;
}

// ─── Billing Cycle Normalization ─────────────────────────────────────────────

/**
 * Normalize a subscription cost to a monthly equivalent.
 * Lifetime subscriptions contribute 0 to monthly spend.
 */
export function normalizeToMonthly(cost: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'monthly':    return cost;
    case 'yearly':     return Math.round((cost / 12) * 100) / 100;
    case 'weekly':     return Math.round((cost * 52) / 12 * 100) / 100;
    case 'quarterly':  return Math.round((cost / 3) * 100) / 100;
    case 'lifetime':   return 0;
  }
}

// ─── SpendStats Computation ──────────────────────────────────────────────────

const UPCOMING_WINDOW_DAYS = 7;

/**
 * Compute aggregate spend statistics from a list of subscriptions and user settings.
 * Only active and trial subscriptions contribute to spend totals.
 * Paused and cancelled subscriptions are excluded from monetary totals.
 */
export function computeSpendStats(
  subscriptions: Subscription[],
  settings: UserSettings,
): SpendStats {
  const displayCurrency = settings.currency;
  const rates = EXCHANGE_RATES_USD_BASE;

  let monthlyTotal = 0;
  let isApproximate = false;
  let activeCount = 0;
  let cancelledCount = 0;
  let trialCount = 0;
  let pausedCount = 0;

  const byCategory: Record<Category, number> = Object.fromEntries(
    ALL_CATEGORIES.map((c) => [c, 0]),
  ) as Record<Category, number>;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const upcomingRenewals: UpcomingRenewal[] = [];

  for (const sub of subscriptions) {
    // Count by status
    switch (sub.status) {
      case 'active':    activeCount++;    break;
      case 'cancelled': cancelledCount++; break;
      case 'paused':    pausedCount++;    break;
      case 'trial':     trialCount++;     break;
    }

    // Only active and trial contribute to spend
    if (sub.status !== 'active' && sub.status !== 'trial') continue;

    const monthlyInOriginal = normalizeToMonthly(sub.cost, sub.billingCycle);
    const monthlyConverted = convertCurrency(monthlyInOriginal, sub.currency, displayCurrency, rates);

    if (sub.currency !== displayCurrency) isApproximate = true;

    monthlyTotal += monthlyConverted;
    byCategory[sub.category] = (byCategory[sub.category] ?? 0) + monthlyConverted;

    // Upcoming renewals within the window
    const renewal = new Date(sub.renewalDate);
    if (renewal >= now && renewal <= windowEnd) {
      const convertedCost = convertCurrency(sub.cost, sub.currency, displayCurrency, rates);
      upcomingRenewals.push({
        subscriptionId: sub.id,
        service: sub.customName ?? sub.service,
        renewalDate: sub.renewalDate,
        cost: sub.cost,
        currency: sub.currency,
        convertedCost,
        isTrial: sub.status === 'trial',
      });
    }
  }

  monthlyTotal = Math.round(monthlyTotal * 100) / 100;
  const annualProjection = Math.round(monthlyTotal * 12 * 100) / 100;

  upcomingRenewals.sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));

  return {
    monthlyTotal,
    annualProjection,
    activeCount,
    cancelledCount,
    trialCount,
    pausedCount,
    upcomingRenewals,
    byCategory,
    currency: displayCurrency,
    isApproximate,
  };
}

// ─── Duplicate Detection ─────────────────────────────────────────────────────

/**
 * Returns true if the candidate subscription shares the same service name
 * and renewal date as any existing active subscription.
 */
export function isDuplicate(
  candidate: Pick<Subscription, 'service' | 'renewalDate'>,
  existing: Subscription[],
): boolean {
  const candidateService = candidate.service.trim().toLowerCase();
  return existing.some(
    (sub) =>
      sub.status === 'active' &&
      sub.service.trim().toLowerCase() === candidateService &&
      sub.renewalDate === candidate.renewalDate,
  );
}

// ─── Subscription Validation ─────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const VALID_BILLING_CYCLES: BillingCycle[] = ['monthly', 'yearly', 'weekly', 'quarterly', 'lifetime'];
const VALID_CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'PKR', 'INR', 'CAD', 'AUD'];
const VALID_STATUSES = ['active', 'cancelled', 'paused', 'trial'] as const;

/**
 * Validate a subscription input object.
 * Returns a ValidationResult with all field-level errors.
 */
export function validateSubscription(
  input: Partial<Subscription>,
): ValidationResult {
  const errors: ValidationError[] = [];

  // service name — required, must not be blank/whitespace-only
  if (!input.service || input.service.trim().length === 0) {
    errors.push({ field: 'service', message: 'Service name is required and cannot be blank.' });
  }

  // cost — required, must be a non-negative finite number
  if (input.cost === undefined || input.cost === null) {
    errors.push({ field: 'cost', message: 'Cost is required.' });
  } else if (!isFinite(input.cost) || input.cost < 0) {
    errors.push({ field: 'cost', message: 'Cost must be a non-negative number.' });
  }

  // currency — required, must be a valid Currency value
  if (!input.currency) {
    errors.push({ field: 'currency', message: 'Currency is required.' });
  } else if (!VALID_CURRENCIES.includes(input.currency)) {
    errors.push({ field: 'currency', message: `Currency must be one of: ${VALID_CURRENCIES.join(', ')}.` });
  }

  // billingCycle — required
  if (!input.billingCycle) {
    errors.push({ field: 'billingCycle', message: 'Billing cycle is required.' });
  } else if (!VALID_BILLING_CYCLES.includes(input.billingCycle)) {
    errors.push({ field: 'billingCycle', message: `Billing cycle must be one of: ${VALID_BILLING_CYCLES.join(', ')}.` });
  }

  // renewalDate — required, must be a valid ISO 8601 date string
  if (!input.renewalDate) {
    errors.push({ field: 'renewalDate', message: 'Renewal date is required.' });
  } else if (isNaN(Date.parse(input.renewalDate))) {
    errors.push({ field: 'renewalDate', message: 'Renewal date must be a valid date.' });
  }

  // status — if provided, must be valid
  if (input.status && !VALID_STATUSES.includes(input.status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}.` });
  }

  return { valid: errors.length === 0, errors };
}
