import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAllSubscriptions } from '../../shared/db';
import { getSettings } from '../../shared/storage';
import { convertCurrency } from '../../shared/utils';
import { EXCHANGE_RATES_USD_BASE } from '../../shared/constants';
import browser from '../../shared/browser';
import type { Subscription, Currency } from '../../shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_BADGE: Record<string, string> = {
  trial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

// ─── Renewal Panel ────────────────────────────────────────────────────────────

interface RenewalPanelProps {
  selectedDate: string | null;
  renewalsOnDate: Subscription[];
  displayCurrency: Currency;
}

function RenewalPanel({ selectedDate, renewalsOnDate, displayCurrency }: RenewalPanelProps) {
  if (!selectedDate) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
        <div
          className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-3"
          aria-hidden="true"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-400">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M8 2v4M16 2v4M3 10h18" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Select a date to see renewals</p>
      </div>
    );
  }

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{dateLabel}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {renewalsOnDate.length === 0
            ? 'No renewals'
            : `${renewalsOnDate.length} renewal${renewalsOnDate.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {renewalsOnDate.length === 0 ? (
        <div className="flex items-center justify-center flex-1 px-4">
          <p className="text-sm text-gray-400 dark:text-gray-500">No renewals on this date</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
          {renewalsOnDate.map((sub) => {
            const displayName = sub.customName ?? sub.service;
            const convertedCost = convertCurrency(
              sub.cost,
              sub.currency,
              displayCurrency,
              EXCHANGE_RATES_USD_BASE,
            );
            const showConverted = sub.currency !== displayCurrency;

            return (
              <li key={sub.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                      {displayName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {fmtCurrency(sub.cost, sub.currency)}
                        {showConverted && (
                          <span className="text-gray-400 dark:text-gray-500 ml-1">
                            ≈ {fmtCurrency(convertedCost, displayCurrency)}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[sub.status] ?? STATUS_BADGE.active}`}
                  >
                    {sub.status}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

interface MonthGridProps {
  year: number;
  month: number;
  renewalsByDate: Map<string, Subscription[]>;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
}

function MonthGrid({ year, month, renewalsByDate, selectedDate, onSelectDate }: MonthGridProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const today = new Date();
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  // Build grid cells: leading empty cells + day cells
  const cells: Array<{ day: number | null; key: string | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, key: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, key: toDateKey(year, month, d) });
  }

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1" role="row">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1"
            role="columnheader"
            aria-label={label}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5" role="grid" aria-label={`${MONTH_NAMES[month]} ${year}`}>
        {cells.map((cell, idx) => {
          if (!cell.day || !cell.key) {
            return <div key={`empty-${idx}`} role="gridcell" aria-hidden="true" />;
          }

          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedDate;
          const renewals = renewalsByDate.get(cell.key) ?? [];
          const hasRenewals = renewals.length > 0;

          return (
            <button
              key={cell.key}
              role="gridcell"
              aria-label={`${MONTH_NAMES[month]} ${cell.day}${hasRenewals ? `, ${renewals.length} renewal${renewals.length > 1 ? 's' : ''}` : ''}`}
              aria-pressed={isSelected}
              onClick={() => onSelectDate(cell.key!)}
              className={`
                relative flex flex-col items-center justify-start pt-1 pb-1.5 rounded-lg
                min-h-[40px] text-sm transition-colors
                focus:outline-none focus:ring-2 focus:ring-indigo-500
                ${isSelected
                  ? 'bg-indigo-600 text-white'
                  : isToday
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-semibold'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                }
              `}
            >
              <span>{cell.day}</span>
              {/* Renewal dots */}
              {hasRenewals && (
                <span className="flex gap-0.5 mt-0.5" aria-hidden="true">
                  {renewals.slice(0, 3).map((_, i) => (
                    <span
                      key={i}
                      className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/80' : 'bg-indigo-500 dark:bg-indigo-400'}`}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Calendar Page ────────────────────────────────────────────────────────────

export default function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>('USD');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [subs, settings] = await Promise.all([getAllSubscriptions(), getSettings()]);
      setSubscriptions(subs);
      setDisplayCurrency(settings.currency);
    } catch (err) {
      console.error('[Calendar] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Listen for storage changes to update calendar in real time (Req 4.4)
  useEffect(() => {
    const handler = () => { load(); };
    browser.storage.onChanged.addListener(handler);
    return () => browser.storage.onChanged.removeListener(handler);
  }, [load]);

  // Build a map of dateKey → subscriptions for fast lookup
  const renewalsByDate = useMemo(() => {
    const map = new Map<string, Subscription[]>();
    for (const sub of subscriptions) {
      if (sub.status === 'cancelled') continue;
      const key = sub.renewalDate.slice(0, 10); // YYYY-MM-DD
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, sub]);
    }
    return map;
  }, [subscriptions]);

  const renewalsOnSelected = selectedDate ? (renewalsByDate.get(selectedDate) ?? []) : [];

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelectedDate(null);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelectedDate(null);
  }

  if (loading) {
    return (
      <div className="p-4" aria-busy="true" aria-label="Loading calendar">
        <div className="h-8 w-48 rounded bg-gray-100 dark:bg-gray-800 animate-pulse mb-4" />
        <div className="grid grid-cols-7 gap-0.5">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Calendar grid */}
      <div className="flex-1 p-4 overflow-y-auto min-w-0">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            aria-label="Previous month"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M10 12L6 8l4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {MONTH_NAMES[month]} {year}
          </h2>

          <button
            onClick={nextMonth}
            aria-label="Next month"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Month grid */}
        <MonthGrid
          year={year}
          month={month}
          renewalsByDate={renewalsByDate}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      {/* Right: Renewal detail panel */}
      <div className="w-52 shrink-0 border-l border-gray-200 dark:border-gray-700 overflow-hidden">
        <RenewalPanel
          selectedDate={selectedDate}
          renewalsOnDate={renewalsOnSelected}
          displayCurrency={displayCurrency}
        />
      </div>
    </div>
  );
}
