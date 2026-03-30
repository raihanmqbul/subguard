import { useState, useEffect } from 'react';
import { setSettings, getLicense } from '../shared/storage';
import { addSubscription } from '../shared/db';
import { validateSubscription } from '../shared/utils';
import { SERVICE_CATALOG } from '../shared/constants';
import browser from '../shared/browser';
import type { BillingCycle, Category, Currency, Subscription } from '../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'welcome' | 'gmail' | 'quick-add';

interface QuickAddForm {
  service: string;
  cost: string;
  currency: Currency;
  billingCycle: BillingCycle;
  renewalDate: string;
}

const EMPTY_FORM: QuickAddForm = {
  service: '',
  cost: '',
  currency: 'USD',
  billingCycle: 'monthly',
  renewalDate: '',
};

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-8">
      {/* Logo with CSS animation */}
      <div
        className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg"
        style={{ animation: 'pulse 2s ease-in-out infinite' }}
        aria-hidden="true"
      >
        <svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M22 6L36 14V30L22 38L8 30V14L22 6Z"
            stroke="white"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M22 14L28 18V26L22 30L16 26V18L22 14Z"
            fill="white"
            fillOpacity="0.8"
          />
        </svg>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">
          Welcome to SubGuard
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-xs">
          Track, manage, and cancel your subscriptions — all locally, no cloud required.
        </p>
      </div>

      <ul className="text-left text-sm text-gray-600 dark:text-gray-300 space-y-2 w-full max-w-xs">
        {[
          '📊 Dashboard with spend analytics',
          'Renewal reminders before you get charged',
          '❌ Step-by-step cancel guides',
          '🔒 All data stays on your device',
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onNext}
        className="w-full max-w-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Get Started
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 10px 25px rgba(99,102,241,0.4); }
          50% { transform: scale(1.05); box-shadow: 0 15px 35px rgba(99,102,241,0.6); }
        }
      `}</style>
    </div>
  );
}

// ─── Step 2: Gmail Connect (Pro gate) ────────────────────────────────────────

function GmailStep({ onNext, onSkip, isPro }: { onNext: () => void; onSkip: () => void; isPro: boolean }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (!isPro) {
      onNext(); // skip to next step, upgrade prompt shown below
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      // Trigger Gmail OAuth via service worker message
      const response = await browser.runtime.sendMessage({ type: 'START_EMAIL_SCAN', payload: {} }) as { success?: boolean; error?: string } | undefined;
      if (response?.success) {
        onNext();
      } else {
        setError(response?.error ?? 'Gmail connection failed. You can set this up later in Settings.');
      }
    } catch {
      setError('Gmail connection failed. You can set this up later in Settings.');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="flex flex-col items-center text-center gap-6 py-8">
      <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="2" y="6" width="28" height="20" rx="3" fill="#EA4335" />
          <path d="M2 9L16 18L30 9" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">
          Connect Gmail <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-0.5 rounded-full ml-1 align-middle">Pro</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-xs text-sm">
          Automatically discover subscriptions from your Gmail receipts. Your emails are never stored or sent anywhere.
        </p>
      </div>

      {!isPro && (
        <div className="w-full max-w-xs bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg px-4 py-3 text-sm text-indigo-700 dark:text-indigo-300">
          Gmail scanning is a Pro feature. Upgrade to unlock it.
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-500 max-w-xs">{error}</p>
      )}

      <div className="flex flex-col gap-2 w-full max-w-xs">
        {isPro ? (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
          >
            {connecting ? 'Connecting…' : 'Connect Gmail'}
          </button>
        ) : (
          <button
            onClick={onNext}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Upgrade to Pro
          </button>
        )}
        <button
          onClick={onSkip}
          className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-2 transition-colors focus:outline-none focus:underline"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Quick Add ───────────────────────────────────────────────────────

function QuickAddStep({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [form, setForm] = useState<QuickAddForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const catalogNames = SERVICE_CATALOG.map((e) => e.name);

  function handleChange(field: keyof QuickAddForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }

  async function handleSave() {
    const cost = parseFloat(form.cost);
    const newErrors: Record<string, string> = {};

    if (!form.service.trim()) newErrors.service = 'Service name is required';
    if (isNaN(cost) || cost <= 0) newErrors.cost = 'Enter a valid cost';
    if (!form.renewalDate) newErrors.renewalDate = 'Renewal date is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const catalogEntry = SERVICE_CATALOG.find(
      (e) => e.name.toLowerCase() === form.service.toLowerCase()
    );

    const now = new Date().toISOString();
    const subscription: Subscription = {
      id: crypto.randomUUID(),
      service: form.service.trim(),
      cost,
      currency: form.currency,
      billingCycle: form.billingCycle,
      renewalDate: form.renewalDate,
      status: 'active',
      category: (catalogEntry?.defaultCategory ?? 'other') as Category,
      cancelUrl: catalogEntry?.defaultCancelUrl,
      logoKey: catalogEntry?.key,
      createdAt: now,
      updatedAt: now,
    };

    const validationResult = validateSubscription(subscription);
    if (!validationResult.valid) {
      setErrors({ service: validationResult.errors[0]?.message ?? 'Invalid subscription' });
      return;
    }

    setSaving(true);
    try {
      await addSubscription(subscription);
      onComplete();
    } catch (err) {
      setErrors({ service: `Failed to save: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 py-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-1">
          Add your first subscription
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You can add more from the dashboard later.
        </p>
      </div>

      {/* Service name */}
      <div>
        <label htmlFor="ob-service" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Service name <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id="ob-service"
          type="text"
          list="ob-service-list"
          value={form.service}
          onChange={(e) => handleChange('service', e.target.value)}
          placeholder="e.g. Netflix"
          aria-required="true"
          aria-describedby={errors.service ? 'ob-service-error' : undefined}
          className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.service ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
        />
        <datalist id="ob-service-list">
          {catalogNames.map((name) => <option key={name} value={name} />)}
        </datalist>
        {errors.service && <p id="ob-service-error" role="alert" className="text-xs text-red-500 mt-1">{errors.service}</p>}
      </div>

      {/* Cost + Currency */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor="ob-cost" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Cost <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="ob-cost"
            type="number"
            min="0"
            step="0.01"
            value={form.cost}
            onChange={(e) => handleChange('cost', e.target.value)}
            placeholder="9.99"
            aria-required="true"
            aria-describedby={errors.cost ? 'ob-cost-error' : undefined}
            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.cost ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
          />
          {errors.cost && <p id="ob-cost-error" role="alert" className="text-xs text-red-500 mt-1">{errors.cost}</p>}
        </div>
        <div className="w-24">
          <label htmlFor="ob-currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Currency
          </label>
          <select
            id="ob-currency"
            value={form.currency}
            onChange={(e) => handleChange('currency', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {(['USD', 'EUR', 'GBP', 'PKR', 'INR', 'CAD', 'AUD'] as Currency[]).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Billing cycle */}
      <div>
        <label htmlFor="ob-cycle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Billing cycle
        </label>
        <select
          id="ob-cycle"
          value={form.billingCycle}
          onChange={(e) => handleChange('billingCycle', e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {(['monthly', 'yearly', 'weekly', 'quarterly', 'lifetime'] as BillingCycle[]).map((c) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Renewal date */}
      <div>
        <label htmlFor="ob-renewal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Next renewal date <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id="ob-renewal"
          type="date"
          value={form.renewalDate}
          onChange={(e) => handleChange('renewalDate', e.target.value)}
          aria-required="true"
          aria-describedby={errors.renewalDate ? 'ob-renewal-error' : undefined}
          className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.renewalDate ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
        />
        {errors.renewalDate && <p id="ob-renewal-error" role="alert" className="text-xs text-red-500 mt-1">{errors.renewalDate}</p>}
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {saving ? 'Saving…' : 'Add Subscription'}
        </button>
        <button
          onClick={onSkip}
          className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-2 transition-colors focus:outline-none focus:underline"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ─── Progress Indicator ──────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i + 1 === current
              ? 'w-6 bg-indigo-600'
              : i + 1 < current
              ? 'w-3 bg-indigo-300 dark:bg-indigo-700'
              : 'w-3 bg-gray-200 dark:bg-gray-700'
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

// ─── Completion Screen ───────────────────────────────────────────────────────

function CompletionScreen() {
  function openDashboard() {
    // Open the side panel / dashboard
    browser.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    window.close();
  }

  return (
    <div className="flex flex-col items-center text-center gap-6 py-8">
      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="#22c55e" />
          <path d="M9 16L14 21L23 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">You're all set!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
          SubGuard is ready to help you track your subscriptions and stay on top of renewals.
        </p>
      </div>
      <button
        onClick={openDashboard}
        className="w-full max-w-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Open Dashboard
      </button>
    </div>
  );
}

// ─── Onboarding Root ─────────────────────────────────────────────────────────

export default function Onboarding() {
  const [step, setStep] = useState<Step>('welcome');
  const [isPro, setIsPro] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getLicense().then((license) => {
      setIsPro(license?.isValid === true);
    });
  }, []);

  async function completeOnboarding() {
    await setSettings({ onboardingComplete: true });
    setDone(true);
  }

  const stepIndex: Record<Step, number> = { welcome: 1, gmail: 2, 'quick-add': 3 };

  if (done) return <CompletionScreen />;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {step !== 'welcome' && (
          <div className="mb-6">
            <StepIndicator current={stepIndex[step]} total={3} />
          </div>
        )}

        {step === 'welcome' && (
          <WelcomeStep onNext={() => setStep('gmail')} />
        )}

        {step === 'gmail' && (
          <GmailStep
            isPro={isPro}
            onNext={() => setStep('quick-add')}
            onSkip={() => setStep('quick-add')}
          />
        )}

        {step === 'quick-add' && (
          <QuickAddStep
            onComplete={completeOnboarding}
            onSkip={completeOnboarding}
          />
        )}
      </div>
    </div>
  );
}
