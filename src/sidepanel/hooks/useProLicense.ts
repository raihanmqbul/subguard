import { useState, useEffect } from 'react';
import { getSettings, getLicense } from '../../shared/storage';
import browser from '../../shared/browser';
import type { Storage } from 'webextension-polyfill/namespaces/storage';

/**
 * Reads the Pro license status from chrome.storage.local.
 * Returns `true` when a valid Pro license is active.
 *
 * Checks both `settings.proLicense` (fast path) and `license.isValid`
 * (authoritative) so the hook stays correct after revalidation.
 */
export function useProLicense(): { isPro: boolean; loading: boolean } {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const [settings, license] = await Promise.all([getSettings(), getLicense()]);
        if (!cancelled) {
          setIsPro(settings.proLicense || (license?.isValid ?? false));
        }
      } catch {
        // Fail open to free tier on storage error
        if (!cancelled) setIsPro(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void check();

    // Re-check when storage changes (e.g. license validated in Settings tab)
    const handler = (changes: Record<string, Storage.StorageChange>) => {
      if ('settings' in changes || 'license' in changes) {
        void check();
      }
    };
    browser.storage.local.onChanged.addListener(handler);

    return () => {
      cancelled = true;
      browser.storage.local.onChanged.removeListener(handler);
    };
  }, []);

  return { isPro, loading };
}
