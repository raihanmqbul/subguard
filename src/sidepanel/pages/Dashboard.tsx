import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSubscriptions, deleteSubscription, updateSubscription } from '../../shared/db';
import { getSettings } from '../../shared/storage';
import { computeSpendStats, convertCurrency } from '../../shared/utils';
import { EXCHANGE_RATES_USD_BASE } from '../../shared/constants';
import { scheduleRenewalAlarm, cancelAlarm } from '../../background/alarms';
import { useToastContext } from '../context/ToastContext';
import { useProLicense } from '../hooks/useProLicense';
import { getRecommendation } from '../../shared/aiRecommendations';
import type { SubscriptionRecommendation } from '../../shared/aiRecommendations';
import type { Subscription, UserSettings, SpendStats, Category } from '../../shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | Category | 'cancelled';
type SortOption = 'renewal' | 'cost' | 'name';

// ─── Stat Bar ─────────────────────────────────────────────────────────────────

function StatBar({ stats }: { stats: SpendStats }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: stats.currency, maximumFractionDigits: 2 }).format(n);

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      <StatCard label="Monthly Total" value={fmt(stats.monthlyTotal)} />
      <StatCard label="Annual Projection" value={fmt(stats.annualProjection)} />
      <StatCard label="Active" value={String(stats.activeCount + stats.trialCount)} />
      <StatCard label="Cancelled" value={String(stats.cancelledCount)} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-50 truncate">{value}</p>
    </div>
  );
}

// ─── Multi-currency Disclaimer ────────────────────────────────────────────────

function ApproximateBanner({ currency }: { currency: string }) {
  return (
    <div
      role="note"
      className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      Totals are approximate — subscriptions in multiple currencies converted to {currency}.
    </div>
  );
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'saas', label: 'SaaS' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'food', label: 'Food' },
  { value: 'ai', label: 'AI' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface FilterTabsProps {
  active: FilterTab;
  onChange: (tab: FilterTab) => void;
}

function FilterTabs({ active, onChange }: FilterTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter subscriptions by category"
      className="flex gap-1 overflow-x-auto pb-1 mb-3 scrollbar-none"
    >
      {FILTER_TABS.map(({ value, label }) => (
        <button
          key={value}
          role="tab"
          aria-selected={active === value}
          onClick={() => onChange(value)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            active === value
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Sort Controls ────────────────────────────────────────────────────────────

interface SortControlsProps {
  sort: SortOption;
  onChange: (s: SortOption) => void;
}

function SortControls({ sort, onChange }: SortControlsProps) {
  return (
    <div className="flex items-center gap-2 mb-3" role="group" aria-label="Sort subscriptions">
      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0" aria-hidden="true">Sort:</span>
      {(['renewal', 'cost', 'name'] as SortOption[]).map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          aria-pressed={sort === opt}
          className={`text-xs px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            sort === opt
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {opt === 'renewal' ? 'Renewal Date' : opt === 'cost' ? 'Cost' : 'Name'}
        </button>
      ))}
    </div>
  );
}

// ─── Subscription Card ────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  trial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-600',
  paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  active: '',
};

const STATUS_LABEL: Record<string, string> = {
  trial: '⏱ Trial',
  paused: 'Paused',
  cancelled: 'Cancelled',
  active: '',
};

const CATEGORY_COLORS: Record<string, string> = {
  streaming: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  saas: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  fitness: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  food: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  music: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  cloud: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  ai: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  education: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  other: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

/** Generate a deterministic color from a string for the avatar fallback */
function avatarColor(name: string): string {
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-teal-500', 'bg-cyan-500',
    'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500',
    'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[hash % colors.length];
}

interface SubscriptionCardProps {
  sub: Subscription;
  displayCurrency: string;
  isPro: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onCancelHelper: (id: string) => void;
  onRecommend: (sub: Subscription) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

function SubscriptionCard({ sub, displayCurrency, isPro, onEdit, onDelete, onCancelHelper, onRecommend, onPause, onResume }: SubscriptionCardProps) {
  const [hovered, setHovered] = useState(false);

  const displayName = sub.customName ?? sub.service;
  const initial = displayName.charAt(0).toUpperCase();

  const fmtCost = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);

  const convertedCost = convertCurrency(sub.cost, sub.currency, displayCurrency as any, EXCHANGE_RATES_USD_BASE);
  const showConverted = sub.currency !== displayCurrency;

  const renewalLabel = (() => {
    const d = new Date(sub.renewalDate);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Renewed ${Math.abs(diffDays)}d ago`;
    if (diffDays === 0) return 'Renews today';
    if (diffDays <= 7) return `Renews in ${diffDays}d`;
    return `Renews ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  })();

  // Req 23.2 — trial expiry warning when trial ends within 3 days
  const trialExpiryWarning = (() => {
    if (sub.status !== 'trial') return null;
    const d = new Date(sub.renewalDate);
    const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Trial may have converted';
    if (diffDays <= 3) return `Trial ends in ${diffDays}d`;
    return null;
  })();

  return (
    <div
      className="relative flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-shadow hover:shadow-md"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Logo / Avatar */}
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-sm ${avatarColor(displayName)}`}
        aria-hidden="true"
      >
        {sub.logoKey ? (
          <img
            src={`/service-logos/${sub.logoKey}.png`}
            alt=""
            className="w-10 h-10 rounded-lg object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          initial
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-900 dark:text-gray-50 truncate">{displayName}</span>
          {/* Status badge — distinct styling per status (Req 23.2) */}
          {sub.status !== 'active' && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[sub.status]}`}>
              {STATUS_LABEL[sub.status] ?? sub.status}
            </span>
          )}
          {/* Trial expiry warning (Req 23.2) */}
          {trialExpiryWarning && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-600">
              {trialExpiryWarning}
            </span>
          )}
          {/* Category chip */}
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[sub.category] ?? CATEGORY_COLORS.other}`}>
            {sub.category}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          <span>{fmtCost(sub.cost, sub.currency)}</span>
          {showConverted && (
            <span className="text-gray-400 dark:text-gray-500">
              ≈ {fmtCost(convertedCost, displayCurrency)}
            </span>
          )}
          <span>·</span>
          <span>{renewalLabel}</span>
        </div>
      </div>

      {/* Hover actions */}
      {hovered && (
        <div className="flex items-center gap-1 shrink-0" role="group" aria-label={`Actions for ${displayName}`}>
          <ActionButton label="Edit" onClick={() => onEdit(sub.id)}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-9.9 9.9-3.414.586.586-3.414 9.9-9.9z" strokeLinejoin="round" />
            </svg>
          </ActionButton>
          {/* Pause/Resume actions (Req 24.1–24.5) */}
          {(sub.status === 'active' || sub.status === 'trial') && (
            <ActionButton label="Pause subscription" onClick={() => onPause(sub.id)}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
              </svg>
            </ActionButton>
          )}
          {sub.status === 'paused' && (
            <ActionButton label="Resume subscription" onClick={() => onResume(sub.id)}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </ActionButton>
          )}
          <ActionButton label="Cancel helper" onClick={() => onCancelHelper(sub.id)}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="10" cy="10" r="8" />
              <path d="M10 6v4l2.5 2.5" strokeLinecap="round" />
            </svg>
          </ActionButton>
          {isPro && (
            <ActionButton label="Should I keep this?" onClick={() => onRecommend(sub)}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M10 2l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 14.27l-4.77 2.44.91-5.32L2.27 7.62l5.34-.78L10 2z" strokeLinejoin="round" />
              </svg>
            </ActionButton>
          )}
          <ActionButton label="Delete" onClick={() => onDelete(sub.id)} danger>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
            </svg>
          </ActionButton>
        </div>
      )}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}

function ActionButton({ label, onClick, danger, children }: ActionButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Recommendation Modal ─────────────────────────────────────────────────────

const VERDICT_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  keep: {
    bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
    text: 'text-green-700 dark:text-green-300',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  cancel: {
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
    text: 'text-red-700 dark:text-red-300',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  review: {
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-300',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v5M10 14v.5" strokeLinecap="round" />
      </svg>
    ),
  },
};

const IMPACT_DOT: Record<string, string> = {
  positive: 'bg-green-500',
  negative: 'bg-red-500',
  neutral: 'bg-gray-400',
};

interface RecommendationModalProps {
  sub: Subscription;
  recommendation: SubscriptionRecommendation;
  onClose: () => void;
}

function RecommendationModal({ sub, recommendation, onClose }: RecommendationModalProps) {
  const { verdict, rationale, factors } = recommendation;
  const style = VERDICT_STYLES[verdict];
  const displayName = sub.customName ?? sub.service;
  const verdictLabel = verdict === 'keep' ? 'Keep it' : verdict === 'cancel' ? 'Consider cancelling' : 'Review needed';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`AI recommendation for ${displayName}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className={`flex items-center gap-3 px-4 py-3 border ${style.bg}`}>
          <span className={style.text}>{style.icon}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${style.text}`}>{verdictLabel}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{displayName}</p>
          </div>
          <button
            aria-label="Close recommendation"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Rationale */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{rationale}</p>
        </div>

        {/* Factors */}
        <ul className="px-4 py-3 space-y-2">
          {factors.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${IMPACT_DOT[f.impact]}`} aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{f.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{f.description}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-400">
          <rect x="4" y="6" width="24" height="20" rx="3" />
          <path d="M16 12v8M12 16h8" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No subscriptions yet</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Add your first subscription to start tracking your spend.</p>
      <button
        onClick={onAdd}
        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
      >
        Add Subscription
      </button>
    </div>
  );
}

// ─── Filtering & Sorting helpers ──────────────────────────────────────────────

function filterSubscriptions(subs: Subscription[], tab: FilterTab): Subscription[] {
  if (tab === 'all') return subs;
  if (tab === 'cancelled') return subs.filter((s) => s.status === 'cancelled');
  return subs.filter((s) => s.category === tab && s.status !== 'cancelled');
}

function sortSubscriptions(subs: Subscription[], sort: SortOption, displayCurrency: string): Subscription[] {
  return [...subs].sort((a, b) => {
    if (sort === 'renewal') return a.renewalDate.localeCompare(b.renewalDate);
    if (sort === 'name') return (a.customName ?? a.service).localeCompare(b.customName ?? b.service);
    // cost — descending, normalized to display currency
    const aCost = convertCurrency(a.cost, a.currency, displayCurrency as any, EXCHANGE_RATES_USD_BASE);
    const bCost = convertCurrency(b.cost, b.currency, displayCurrency as any, EXCHANGE_RATES_USD_BASE);
    return bCost - aCost;
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { show } = useToastContext();
  const { isPro } = useProLicense();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [stats, setStats] = useState<SpendStats | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortOption>('renewal');
  const [loading, setLoading] = useState(true);
  const [recommendTarget, setRecommendTarget] = useState<Subscription | null>(null);

  const load = useCallback(async () => {
    try {
      const [subs, cfg] = await Promise.all([getAllSubscriptions(), getSettings()]);
      setSubscriptions(subs);
      setSettings(cfg);
      setStats(computeSpendStats(subs, cfg));
    } catch (err) {
      console.error('[Dashboard] Failed to load data:', err);
      show('Failed to load subscriptions.', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (id: string) => {
    const sub = subscriptions.find((s) => s.id === id);
    if (!sub) return;

    // Optimistic removal
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));

    let undone = false;
    const toastId = show(
      `Deleted "${sub.customName ?? sub.service}"`,
      'info',
      {
        label: 'Undo',
        onClick: () => {
          undone = true;
          setSubscriptions((prev) => {
            const exists = prev.some((s) => s.id === id);
            return exists ? prev : [...prev, sub].sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
          });
        },
      }
    );

    // After 5s, if not undone, commit the delete
    setTimeout(async () => {
      if (!undone) {
        try {
          await deleteSubscription(id);
        } catch (err) {
          console.error('[Dashboard] Failed to delete subscription:', err);
          show('Failed to delete subscription.', 'error');
          // Restore on failure
          setSubscriptions((prev) => {
            const exists = prev.some((s) => s.id === id);
            return exists ? prev : [...prev, sub];
          });
        }
      }
      // Dismiss the toast (it auto-dismisses, but we track undone state)
      void toastId;
    }, 5000);
  }, [subscriptions, show]);

  // Recompute stats when subscriptions or settings change
  useEffect(() => {
    if (settings) setStats(computeSpendStats(subscriptions, settings));
  }, [subscriptions, settings]);

  // Req 24.1–24.3 — pause: update status to paused, cancel alarm, exclude from spend
  const handlePause = useCallback(async (id: string) => {
    const sub = subscriptions.find((s) => s.id === id);
    if (!sub) return;
    try {
      await updateSubscription(id, { status: 'paused' });
      cancelAlarm(id);  // Req 24.2 — cancel alarm when paused
      setSubscriptions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'paused' } : s));
      show(`Paused "${sub.customName ?? sub.service}"`, 'info');
    } catch (err) {
      console.error('[Dashboard] Failed to pause subscription:', err);
      show('Failed to pause subscription.', 'error');
    }
  }, [subscriptions, show]);

  // Req 24.4–24.5 — resume: restore active status, re-register alarm
  const handleResume = useCallback(async (id: string) => {
    const sub = subscriptions.find((s) => s.id === id);
    if (!sub) return;
    try {
      await updateSubscription(id, { status: 'active', resumeDate: undefined });
      const cfg = settings ?? await getSettings();
      // Re-register alarm for the resumed subscription (Req 24.5)
      const updated = { ...sub, status: 'active' as const };
      scheduleRenewalAlarm(updated, cfg.reminderDaysBefore);
      setSubscriptions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'active', resumeDate: undefined } : s));
      show(`Resumed "${sub.customName ?? sub.service}"`, 'success');
    } catch (err) {
      console.error('[Dashboard] Failed to resume subscription:', err);
      show('Failed to resume subscription.', 'error');
    }
  }, [subscriptions, settings, show]);  const displayCurrency = settings?.currency ?? 'USD';

  const visible = sortSubscriptions(
    filterSubscriptions(subscriptions, filter),
    sort,
    displayCurrency,
  );

  if (loading) {
    return (
      <div className="p-4 space-y-3" aria-busy="true" aria-label="Loading subscriptions">
        {/* Skeleton stat bar */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
        {/* Skeleton cards */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Visually hidden page title for screen readers */}
      <h1 className="sr-only">Dashboard</h1>

      {/* Stat bar */}
      {stats && <StatBar stats={stats} />}

      {/* Multi-currency disclaimer */}
      {stats?.isApproximate && <ApproximateBanner currency={displayCurrency} />}

      {/* Filter tabs */}
      <FilterTabs active={filter} onChange={setFilter} />

      {/* Sort controls */}
      <SortControls sort={sort} onChange={setSort} />

      {/* Subscription list */}
      {visible.length === 0 ? (
        <EmptyState onAdd={() => navigate('/add')} />
      ) : (
        <ul className="space-y-2" aria-label="Subscriptions">
          {visible.map((sub) => (
            <li key={sub.id}>
              <SubscriptionCard
                sub={sub}
                displayCurrency={displayCurrency}
                isPro={isPro}
                onEdit={(id) => navigate(`/edit/${id}`)}
                onDelete={handleDelete}
                onCancelHelper={(id) => navigate(`/cancel/${id}`)}
                onRecommend={setRecommendTarget}
                onPause={handlePause}
                onResume={handleResume}
              />
            </li>
          ))}
        </ul>
      )}

      {/* AI Recommendation modal */}
      {recommendTarget && (
        <RecommendationModal
          sub={recommendTarget}
          recommendation={getRecommendation(recommendTarget)}
          onClose={() => setRecommendTarget(null)}
        />
      )}
    </div>
  );
}
