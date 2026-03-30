import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { getSettings, getLicense } from '../shared/storage';
import { getAllSubscriptions } from '../shared/db';
import { computeSpendStats, isDuplicate } from '../shared/utils';
import browser from '../shared/browser';
import type { SpendStats, UserSettings } from '../shared/types';

// ─── Error Boundary ──────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SubGuard Popup] Rendering error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <p className="font-medium text-red-500 mb-1">Something went wrong</p>
          <p>Please close and reopen the popup.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Currency Formatter ──────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ─── Popup Content ───────────────────────────────────────────────────────────

function PopupContent() {
  const [stats, setStats] = useState<SpendStats | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [hasDuplicate, setHasDuplicate] = useState(false);
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Read settings and license from chrome.storage.local first (fast path)
        const [s, license] = await Promise.all([getSettings(), getLicense()]);
        if (cancelled) return;

        setSettings(s);
        setIsPro(license?.isValid === true);

        // Then query IndexedDB for subscriptions
        const subs = await getAllSubscriptions();
        if (cancelled) return;

        const computed = computeSpendStats(subs, s);
        setStats(computed);

        // Check for any duplicate among active subscriptions
        const activeSubs = subs.filter((sub) => sub.status === 'active');
        const hasDup = activeSubs.some((sub) =>
          isDuplicate(sub, activeSubs.filter((s2) => s2.id !== sub.id))
        );
        setHasDuplicate(hasDup);
      } catch (err) {
        console.error('[SubGuard Popup] Failed to load data:', err);
        if (!cancelled) setDbError(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  function openSidePanel() {
    // chrome.sidePanel.open() must be called directly in response to a user gesture
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sidePanel = (globalThis as any).chrome?.sidePanel;
    if (sidePanel?.open) {
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        const tabId = tabs[0]?.id;
        if (tabId) {
          sidePanel.open({ tabId }).catch(() => {
            // Fallback: open as a new tab
            browser.tabs.create({ url: browser.runtime.getURL('src/sidepanel/index.html') });
          });
        }
      });
    } else {
      // Firefox fallback
      browser.tabs.create({ url: browser.runtime.getURL('src/sidepanel/index.html') });
    }
    window.close();
  }

  function openAddSubscription() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sidePanel = (globalThis as any).chrome?.sidePanel;
    browser.storage.local.set({ pendingNavigation: '/add' });
    if (sidePanel?.open) {
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        const tabId = tabs[0]?.id;
        if (tabId) {
          sidePanel.open({ tabId }).catch(() => {
            browser.tabs.create({ url: browser.runtime.getURL('src/sidepanel/index.html') });
          });
        }
      });
    } else {
      browser.tabs.create({ url: browser.runtime.getURL('src/sidepanel/index.html') });
    }
    window.close();
  }

  if (dbError) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p className="text-red-500 font-medium mb-1">Unable to load data</p>
        <p>Storage may be unavailable. Please try again.</p>
      </div>
    );
  }

  const currency = settings?.currency ?? 'USD';
  const upcomingThree = stats?.upcomingRenewals.slice(0, 3) ?? [];

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          SubGuard
        </span>
        {isPro && (
          <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-0.5 rounded-full">
            Pro
          </span>
        )}
      </div>

      {/* Duplicate detection notice */}
      {hasDuplicate && (
        <div
          role="alert"
          className="text-xs bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 rounded px-3 py-2"
        >
          Duplicate subscription detected. Open the dashboard to review.
        </div>
      )}

      {/* Monthly spend total */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Monthly spend</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          {stats ? formatCurrency(stats.monthlyTotal, currency) : '—'}
        </p>
        {stats?.isApproximate && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">~approximate</p>
        )}
      </div>

      {/* Upcoming renewals */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          Upcoming renewals
        </p>
        {upcomingThree.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">No renewals in the next 7 days</p>
        ) : (
          <ul className="flex flex-col gap-1.5" aria-label="Upcoming renewals">
            {upcomingThree.map((renewal) => (
              <li
                key={renewal.subscriptionId}
                className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded px-3 py-1.5"
              >
                <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[120px]">
                  {renewal.service}
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-xs ml-2 shrink-0">
                  {formatDate(renewal.renewalDate)}
                </span>
                <span className="text-gray-700 dark:text-gray-300 text-xs font-medium ml-2 shrink-0">
                  {formatCurrency(renewal.convertedCost, currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={openSidePanel}
          className="flex-1 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          aria-label="Open dashboard"
        >
          Open Dashboard
        </button>
        <button
          onClick={openAddSubscription}
          className="flex-1 text-sm font-medium bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-md py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          aria-label="Add subscription"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

// ─── Popup Root ──────────────────────────────────────────────────────────────

export default function Popup() {
  return (
    <ErrorBoundary>
      <PopupContent />
    </ErrorBoundary>
  );
}
