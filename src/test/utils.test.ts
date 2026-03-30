import { describe, it, expect } from 'vitest';
import {
  convertCurrency,
  normalizeToMonthly,
  computeSpendStats,
  isDuplicate,
  validateSubscription,
} from '../shared/utils';
import { DEFAULT_SETTINGS, EXCHANGE_RATES_USD_BASE } from '../shared/constants';
import type { Subscription, UserSettings } from '../shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'test-id',
    service: 'Netflix',
    cost: 15.99,
    currency: 'USD',
    billingCycle: 'monthly',
    renewalDate: '2099-01-01',
    status: 'active',
    category: 'streaming',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const settings: UserSettings = { ...DEFAULT_SETTINGS, currency: 'USD' };

// ─── convertCurrency ─────────────────────────────────────────────────────────

describe('convertCurrency', () => {
  it('returns same amount when from === to', () => {
    expect(convertCurrency(100, 'USD', 'USD')).toBe(100);
  });

  it('converts USD to EUR correctly', () => {
    const result = convertCurrency(100, 'USD', 'EUR', EXCHANGE_RATES_USD_BASE);
    expect(result).toBeCloseTo(92, 1);
  });

  it('converts EUR back to USD within tolerance', () => {
    const eur = convertCurrency(100, 'USD', 'EUR', EXCHANGE_RATES_USD_BASE);
    const back = convertCurrency(eur, 'EUR', 'USD', EXCHANGE_RATES_USD_BASE);
    expect(Math.abs(back - 100)).toBeLessThan(0.02);
  });
});

// ─── normalizeToMonthly ───────────────────────────────────────────────────────

describe('normalizeToMonthly', () => {
  it('monthly stays the same', () => {
    expect(normalizeToMonthly(10, 'monthly')).toBe(10);
  });

  it('yearly divides by 12', () => {
    expect(normalizeToMonthly(120, 'yearly')).toBeCloseTo(10, 2);
  });

  it('quarterly divides by 3', () => {
    expect(normalizeToMonthly(30, 'quarterly')).toBeCloseTo(10, 2);
  });

  it('weekly multiplies by 52/12', () => {
    expect(normalizeToMonthly(10, 'weekly')).toBeCloseTo((10 * 52) / 12, 2);
  });

  it('lifetime returns 0', () => {
    expect(normalizeToMonthly(999, 'lifetime')).toBe(0);
  });
});

// ─── computeSpendStats ────────────────────────────────────────────────────────

describe('computeSpendStats', () => {
  it('sums active subscriptions into monthlyTotal', () => {
    const subs = [makeSub({ cost: 10 }), makeSub({ id: 'b', cost: 5 })];
    const stats = computeSpendStats(subs, settings);
    expect(stats.monthlyTotal).toBeCloseTo(15, 2);
  });

  it('excludes paused subscriptions from monthlyTotal', () => {
    const subs = [
      makeSub({ cost: 10 }),
      makeSub({ id: 'b', cost: 5, status: 'paused' }),
    ];
    const stats = computeSpendStats(subs, settings);
    expect(stats.monthlyTotal).toBeCloseTo(10, 2);
  });

  it('excludes cancelled subscriptions from monthlyTotal', () => {
    const subs = [
      makeSub({ cost: 10 }),
      makeSub({ id: 'b', cost: 5, status: 'cancelled' }),
    ];
    const stats = computeSpendStats(subs, settings);
    expect(stats.monthlyTotal).toBeCloseTo(10, 2);
  });

  it('includes trial subscriptions in monthlyTotal', () => {
    const subs = [makeSub({ cost: 10, status: 'trial' })];
    const stats = computeSpendStats(subs, settings);
    expect(stats.monthlyTotal).toBeCloseTo(10, 2);
  });

  it('annualProjection is monthlyTotal * 12', () => {
    const subs = [makeSub({ cost: 10 })];
    const stats = computeSpendStats(subs, settings);
    expect(stats.annualProjection).toBeCloseTo(120, 2);
  });

  it('counts statuses correctly', () => {
    const subs = [
      makeSub({ id: '1', status: 'active' }),
      makeSub({ id: '2', status: 'cancelled' }),
      makeSub({ id: '3', status: 'paused' }),
      makeSub({ id: '4', status: 'trial' }),
    ];
    const stats = computeSpendStats(subs, settings);
    expect(stats.activeCount).toBe(1);
    expect(stats.cancelledCount).toBe(1);
    expect(stats.pausedCount).toBe(1);
    expect(stats.trialCount).toBe(1);
  });

  it('sets isApproximate when currencies differ', () => {
    const subs = [makeSub({ currency: 'EUR' })];
    const stats = computeSpendStats(subs, { ...settings, currency: 'USD' });
    expect(stats.isApproximate).toBe(true);
  });

  it('isApproximate is false when all same currency', () => {
    const subs = [makeSub({ currency: 'USD' })];
    const stats = computeSpendStats(subs, { ...settings, currency: 'USD' });
    expect(stats.isApproximate).toBe(false);
  });
});

// ─── isDuplicate ──────────────────────────────────────────────────────────────

describe('isDuplicate', () => {
  const existing = [makeSub({ service: 'Netflix', renewalDate: '2099-01-01', status: 'active' })];

  it('detects duplicate by same service + renewalDate', () => {
    expect(isDuplicate({ service: 'Netflix', renewalDate: '2099-01-01' }, existing)).toBe(true);
  });

  it('returns false for different service', () => {
    expect(isDuplicate({ service: 'Spotify', renewalDate: '2099-01-01' }, existing)).toBe(false);
  });

  it('returns false for different renewalDate', () => {
    expect(isDuplicate({ service: 'Netflix', renewalDate: '2099-02-01' }, existing)).toBe(false);
  });

  it('ignores non-active subscriptions', () => {
    const cancelled = [makeSub({ status: 'cancelled' })];
    expect(isDuplicate({ service: 'Netflix', renewalDate: '2099-01-01' }, cancelled)).toBe(false);
  });

  it('is case-insensitive for service name', () => {
    expect(isDuplicate({ service: 'netflix', renewalDate: '2099-01-01' }, existing)).toBe(true);
  });
});

// ─── validateSubscription ─────────────────────────────────────────────────────

describe('validateSubscription', () => {
  it('passes a fully valid subscription', () => {
    const result = validateSubscription(makeSub());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing service name', () => {
    const result = validateSubscription(makeSub({ service: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'service')).toBe(true);
  });

  it('rejects whitespace-only service name', () => {
    const result = validateSubscription(makeSub({ service: '   ' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'service')).toBe(true);
  });

  it('rejects negative cost', () => {
    const result = validateSubscription(makeSub({ cost: -1 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'cost')).toBe(true);
  });

  it('rejects invalid currency', () => {
    const result = validateSubscription(makeSub({ currency: 'XYZ' as never }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'currency')).toBe(true);
  });

  it('rejects invalid billing cycle', () => {
    const result = validateSubscription(makeSub({ billingCycle: 'biweekly' as never }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'billingCycle')).toBe(true);
  });

  it('rejects invalid renewal date', () => {
    const result = validateSubscription(makeSub({ renewalDate: 'not-a-date' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'renewalDate')).toBe(true);
  });

  it('reports multiple errors at once', () => {
    const result = validateSubscription({ service: '', cost: -1 });
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
