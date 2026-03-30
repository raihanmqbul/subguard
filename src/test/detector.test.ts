/**
 * Unit tests for src/content/detector.ts
 * Tests the pure helper functions used by the content script detector.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  findCatalogEntryForDomain,
  normalizeCycle,
  parseAmount,
  parseDate,
  dismissedServices,
} from '../content/detector';

describe('findCatalogEntryForDomain', () => {
  it('returns entry for exact catalog domain', () => {
    const entry = findCatalogEntryForDomain('netflix.com');
    expect(entry).not.toBeNull();
    expect(entry?.key).toBe('netflix');
    expect(entry?.name).toBe('Netflix');
  });

  it('returns entry for www-prefixed domain', () => {
    const entry = findCatalogEntryForDomain('www.spotify.com');
    expect(entry).not.toBeNull();
    expect(entry?.key).toBe('spotify');
  });

  it('returns entry for subdomain of catalog domain', () => {
    const entry = findCatalogEntryForDomain('account.netflix.com');
    expect(entry).not.toBeNull();
    expect(entry?.key).toBe('netflix');
  });

  it('returns null for unknown domain', () => {
    const entry = findCatalogEntryForDomain('example.com');
    expect(entry).toBeNull();
  });

  it('returns null for empty string', () => {
    const entry = findCatalogEntryForDomain('');
    expect(entry).toBeNull();
  });

  it('handles multi-domain catalog entries (hbomax/max)', () => {
    expect(findCatalogEntryForDomain('hbomax.com')?.key).toBe('hbo-max');
    expect(findCatalogEntryForDomain('max.com')?.key).toBe('hbo-max');
  });

  it('handles chatgpt domains', () => {
    expect(findCatalogEntryForDomain('chat.openai.com')?.key).toBe('chatgpt-plus');
    expect(findCatalogEntryForDomain('chatgpt.com')?.key).toBe('chatgpt-plus');
  });
});

describe('normalizeCycle', () => {
  it('maps "monthly" to monthly', () => {
    expect(normalizeCycle('monthly')).toBe('monthly');
  });

  it('maps "annually" to yearly', () => {
    expect(normalizeCycle('annually')).toBe('yearly');
  });

  it('maps "yearly" to yearly', () => {
    expect(normalizeCycle('yearly')).toBe('yearly');
  });

  it('maps "weekly" to weekly', () => {
    expect(normalizeCycle('weekly')).toBe('weekly');
  });

  it('maps "quarterly" to quarterly', () => {
    expect(normalizeCycle('quarterly')).toBe('quarterly');
  });

  it('defaults unknown values to monthly', () => {
    expect(normalizeCycle('biannual')).toBe('monthly');
  });

  it('is case-insensitive', () => {
    expect(normalizeCycle('MONTHLY')).toBe('monthly');
    expect(normalizeCycle('Annually')).toBe('yearly');
  });
});

describe('parseAmount', () => {
  it('parses a simple dollar amount', () => {
    expect(parseAmount('$15.99')).toBe(15.99);
  });

  it('parses amount with commas', () => {
    expect(parseAmount('$1,299.00')).toBe(1299.0);
  });

  it('parses amount without dollar sign', () => {
    expect(parseAmount('9.99 USD')).toBe(9.99);
  });

  it('returns undefined for non-numeric strings', () => {
    expect(parseAmount('free')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseAmount('')).toBeUndefined();
  });
});

describe('parseDate', () => {
  it('parses a standard date string to a valid ISO date', () => {
    const result = parseDate('January 15, 2025');
    // Result should be a valid YYYY-MM-DD string (timezone may shift by 1 day)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The year and month should be correct
    expect(result?.startsWith('2025-01')).toBe(true);
  });

  it('parses MM/DD/YYYY format to a valid ISO date', () => {
    const result = parseDate('03/15/2025');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result?.startsWith('2025-03')).toBe(true);
  });

  it('returns undefined for invalid date', () => {
    expect(parseDate('not a date')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseDate('')).toBeUndefined();
  });
});

describe('dismissedServices session set', () => {
  beforeEach(() => {
    dismissedServices.clear();
  });

  it('starts empty', () => {
    expect(dismissedServices.size).toBe(0);
  });

  it('can add and check dismissed services', () => {
    dismissedServices.add('netflix');
    expect(dismissedServices.has('netflix')).toBe(true);
    expect(dismissedServices.has('spotify')).toBe(false);
  });
});
