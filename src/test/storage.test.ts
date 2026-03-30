import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSettings, setSettings, getLicense, setLicense } from '../shared/storage';
import { DEFAULT_SETTINGS } from '../shared/constants';
import type { LicenseInfo } from '../shared/types';

// Simple in-memory mock for chrome.storage.local
let store: Record<string, unknown> = {};

beforeEach(() => {
  store = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(store, obj); }),
        remove: vi.fn(async (key: string) => { delete store[key]; }),
      },
    },
  });
});

describe('getSettings', () => {
  it('returns DEFAULT_SETTINGS when nothing is stored', async () => {
    const settings = await getSettings();
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(settings.currency).toBe(DEFAULT_SETTINGS.currency);
    expect(settings.reminderDaysBefore).toBe(DEFAULT_SETTINGS.reminderDaysBefore);
    expect(settings.analyticsOptIn).toBe(false);
  });

  it('merges stored partial settings with defaults', async () => {
    await chrome.storage.local.set({ settings: { theme: 'dark', currency: 'EUR' } });
    const settings = await getSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.currency).toBe('EUR');
    // defaults still present for unset fields
    expect(settings.reminderDaysBefore).toBe(DEFAULT_SETTINGS.reminderDaysBefore);
  });
});

describe('setSettings', () => {
  it('persists a partial settings update', async () => {
    await setSettings({ theme: 'dark' });
    const settings = await getSettings();
    expect(settings.theme).toBe('dark');
  });

  it('does not overwrite unrelated fields', async () => {
    await setSettings({ currency: 'GBP' });
    await setSettings({ theme: 'dark' });
    const settings = await getSettings();
    expect(settings.currency).toBe('GBP');
    expect(settings.theme).toBe('dark');
  });
});

describe('getLicense / setLicense', () => {
  const license: LicenseInfo = {
    key: 'TEST-KEY-123',
    type: 'lifetime',
    validatedAt: '2025-01-01T00:00:00.000Z',
    email: 'user@example.com',
    isValid: true,
  };

  it('returns null when no license is stored', async () => {
    expect(await getLicense()).toBeNull();
  });

  it('stores and retrieves a license', async () => {
    await setLicense(license);
    const result = await getLicense();
    expect(result).toEqual(license);
  });

  it('clears license when null is passed', async () => {
    await setLicense(license);
    await setLicense(null);
    expect(await getLicense()).toBeNull();
  });
});
