import { useNavigate } from 'react-router-dom';
import browser from '../../shared/browser';

// ─── Feature comparison data ──────────────────────────────────────────────────

interface Feature {
  label: string;
  free: boolean | string;
  pro: boolean | string;
}

const FEATURES: Feature[] = [
  { label: 'Manual subscription tracking', free: true, pro: true },
  { label: 'Dashboard & spend analytics', free: true, pro: true },
  { label: 'Calendar view', free: true, pro: true },
  { label: 'Renewal notifications', free: true, pro: true },
  { label: 'Cancel helper (step-by-step)', free: true, pro: true },
  { label: 'CSV export & import', free: true, pro: true },
  { label: 'Auto-detection (basic)', free: true, pro: true },
  { label: 'Email scanning (Gmail)', free: false, pro: true },
  { label: 'AI keep/cancel recommendations', free: false, pro: true },
  { label: 'Cancel button auto-highlight', free: false, pro: true },
  { label: 'Smart categorization', free: false, pro: true },
  { label: 'Full auto-detection', free: false, pro: true },
  { label: 'PDF export', free: false, pro: true },
];

// Lemon Squeezy checkout links — replace with real product URLs before launch
const CHECKOUT_MONTHLY = 'https://subguard.lemonsqueezy.com/checkout/buy/monthly';
const CHECKOUT_LIFETIME = 'https://subguard.lemonsqueezy.com/checkout/buy/lifetime';

// ─── Check / X icons ─────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="text-indigo-600 dark:text-indigo-400"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.5 10l2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="text-gray-300 dark:text-gray-600"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7 7l6 6M13 7l-6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Feature row ──────────────────────────────────────────────────────────────

function FeatureRow({ feature, isLast }: { feature: Feature; isLast: boolean }) {
  return (
    <tr className={isLast ? '' : 'border-b border-gray-100 dark:border-gray-700'}>
      <td className="py-2.5 pr-4 text-sm text-gray-700 dark:text-gray-300">{feature.label}</td>
      <td className="py-2.5 px-4 text-center">
        {typeof feature.free === 'string' ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">{feature.free}</span>
        ) : feature.free ? (
          <span aria-label="Included in Free"><CheckIcon /></span>
        ) : (
          <span aria-label="Not included in Free"><CrossIcon /></span>
        )}
      </td>
      <td className="py-2.5 pl-4 text-center">
        {typeof feature.pro === 'string' ? (
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{feature.pro}</span>
        ) : feature.pro ? (
          <span aria-label="Included in Pro"><CheckIcon /></span>
        ) : (
          <span aria-label="Not included in Pro"><CrossIcon /></span>
        )}
      </td>
    </tr>
  );
}

// ─── Upgrade page ─────────────────────────────────────────────────────────────

export default function Upgrade() {
  const navigate = useNavigate();

  const openCheckout = (url: string) => {
    browser.tabs.create({ url });
  };

  return (
    <div className="p-4 max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Upgrade to Pro</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Unlock the full SubGuard experience</p>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Monthly */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Monthly</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              $4.99
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/mo</span>
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex-1">
            Full Pro access, billed monthly. Cancel any time.
          </p>
          <button
            onClick={() => openCheckout(CHECKOUT_MONTHLY)}
            className="w-full px-3 py-2 border border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-500 text-sm font-medium rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Subscribe
          </button>
        </div>

        {/* Lifetime */}
        <div className="rounded-xl border-2 border-indigo-600 dark:border-indigo-500 bg-white dark:bg-gray-800 p-4 flex flex-col gap-3 relative">
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-600 text-white whitespace-nowrap">
            Best value
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Lifetime</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              $19
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> one-time</span>
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex-1">
            Pay once, own it forever. All future updates included.
          </p>
          <button
            onClick={() => openCheckout(CHECKOUT_LIFETIME)}
            className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Buy Lifetime
          </button>
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full" aria-label="Feature comparison: Free vs Pro">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th scope="col" className="py-2.5 pr-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Feature
              </th>
              <th scope="col" className="py-2.5 px-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Free
              </th>
              <th scope="col" className="py-2.5 pl-4 text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Pro
              </th>
            </tr>
          </thead>
          <tbody className="px-4">
            {FEATURES.map((f, i) => (
              <FeatureRow key={f.label} feature={f} isLast={i === FEATURES.length - 1} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Already have a key? */}
      <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
        Already have a license key?{' '}
        <button
          onClick={() => navigate('/settings')}
          className="text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
        >
          Activate it in Settings
        </button>
      </p>
    </div>
  );
}
