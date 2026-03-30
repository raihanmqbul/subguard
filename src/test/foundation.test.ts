import { describe, it, expect } from 'vitest';
import { SERVICE_CATALOG, EXCHANGE_RATES_USD_BASE, DEFAULT_SETTINGS, SCHEMA_VERSION } from '../shared/constants';

describe('Project foundation', () => {
  it('SERVICE_CATALOG has exactly 40 entries', () => {
    expect(SERVICE_CATALOG).toHaveLength(40);
  });

  it('all catalog entries have required fields', () => {
    for (const entry of SERVICE_CATALOG) {
      expect(entry.key).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.domains.length).toBeGreaterThan(0);
      expect(entry.defaultCategory).toBeTruthy();
      expect(entry.defaultCancelUrl).toMatch(/^https?:\/\//);
      expect(entry.logoFile).toMatch(/\.png$/);
    }
  });

  it('all catalog keys are unique', () => {
    const keys = SERVICE_CATALOG.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('EXCHANGE_RATES_USD_BASE has all 7 currencies', () => {
    const currencies = ['USD', 'EUR', 'GBP', 'PKR', 'INR', 'CAD', 'AUD'];
    for (const c of currencies) {
      expect(EXCHANGE_RATES_USD_BASE).toHaveProperty(c);
      expect(EXCHANGE_RATES_USD_BASE[c as keyof typeof EXCHANGE_RATES_USD_BASE]).toBeGreaterThan(0);
    }
  });

  it('USD base rate is 1.0', () => {
    expect(EXCHANGE_RATES_USD_BASE.USD).toBe(1.0);
  });

  it('DEFAULT_SETTINGS has expected shape', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('light');
    expect(DEFAULT_SETTINGS.currency).toBe('USD');
    expect(DEFAULT_SETTINGS.reminderDaysBefore).toBe(3);
    expect(DEFAULT_SETTINGS.analyticsOptIn).toBe(false);
    expect(DEFAULT_SETTINGS.onboardingComplete).toBe(false);
  });

  it('SCHEMA_VERSION is a positive integer', () => {
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    expect(SCHEMA_VERSION).toBeGreaterThan(0);
  });
});
