import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSubscription, updateSubscription } from '../../shared/db';
import { sendMessage } from '../../shared/messageBus';
import { SERVICE_CATALOG_BY_KEY } from '../../shared/constants';
import { useToastContext } from '../context/ToastContext';
import { ProGate } from '../components/ProGate';
import browser from '../../shared/browser';
import type { Subscription } from '../../shared/types';

// ─── Cancel steps per service ─────────────────────────────────────────────────

const DEFAULT_STEPS = [
  'Log in to your account on the service website.',
  'Navigate to Account Settings or Billing.',
  'Find the Subscription or Membership section.',
  'Click "Cancel Subscription" or "Cancel Plan".',
  'Follow any confirmation prompts to complete cancellation.',
  'Check your email for a cancellation confirmation.',
];

const SERVICE_STEPS: Record<string, string[]> = {
  netflix: [
    'Go to netflix.com and sign in.',
    'Click your profile icon → Account.',
    'Under "Membership & Billing", click "Cancel Membership".',
    'Click "Finish Cancellation" to confirm.',
    'You will retain access until the end of the billing period.',
  ],
  spotify: [
    'Go to spotify.com and log in.',
    'Click your username → Account.',
    'Under "Your plan", click "Change plan".',
    'Scroll down and click "Cancel Premium".',
    'Follow the prompts to confirm cancellation.',
  ],
  hulu: [
    'Go to hulu.com and sign in.',
    'Click your profile → Account.',
    'Under "Your Subscription", click "Cancel".',
    'Select a cancellation reason and confirm.',
  ],
  'disney-plus': [
    'Go to disneyplus.com and sign in.',
    'Click your profile icon → Account.',
    'Under "Subscription", click "Cancel Subscription".',
    'Confirm the cancellation.',
  ],
  'hbo-max': [
    'Go to max.com and sign in.',
    'Click your profile → Settings.',
    'Under "Subscription", click "Cancel Plan".',
    'Follow the prompts to confirm.',
  ],
  'prime-video': [
    'Go to amazon.com and sign in.',
    'Go to Account & Lists → Memberships & Subscriptions.',
    'Find Prime Video and click "Manage".',
    'Select "Cancel Subscription" and confirm.',
  ],
  'apple-tv': [
    'Open the Apple TV app or go to tv.apple.com.',
    'Click your account icon → Settings.',
    'Under Subscriptions, find Apple TV+ and click "Cancel".',
    'Confirm the cancellation.',
  ],
  'youtube-premium': [
    'Go to youtube.com/paid_memberships and sign in.',
    'Click "Manage membership".',
    'Click "Deactivate" next to YouTube Premium.',
    'Follow the prompts to confirm.',
  ],
  notion: [
    'Go to notion.so and sign in.',
    'Click Settings & Members → Plans.',
    'Click "Downgrade" to switch to the free plan.',
    'Confirm the downgrade.',
  ],
  slack: [
    'Go to slack.com and sign in to your workspace.',
    'Click the workspace name → Settings & administration → Billing.',
    'Click "Cancel plan" and follow the prompts.',
  ],
  'adobe-cc': [
    'Go to account.adobe.com/plans and sign in.',
    'Find your Creative Cloud plan and click "Manage plan".',
    'Click "Cancel plan" and follow the prompts.',
    'Note: Early cancellation may incur a fee.',
  ],
  github: [
    'Go to github.com/settings/billing and sign in.',
    'Under "Current plan", click "Downgrade to Free".',
    'Confirm the downgrade.',
  ],
  'chatgpt-plus': [
    'Go to chat.openai.com and sign in.',
    'Click your profile icon → My plan.',
    'Click "Manage my subscription".',
    'Click "Cancel plan" and confirm.',
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCost(cost: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(cost);
}

function daysUntil(iso: string): number {
  const now = new Date();
  const renewal = new Date(iso);
  return Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Step List ────────────────────────────────────────────────────────────────

function StepList({ steps }: { steps: string[] }) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <ol className="space-y-2" aria-label="Cancellation steps">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <button
            onClick={() => toggle(i)}
            aria-label={completed.has(i) ? `Unmark step ${i + 1}` : `Mark step ${i + 1} as done`}
            className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              completed.has(i)
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
            }`}
          >
            {completed.has(i) && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span className="sr-only">{i + 1}</span>
          </button>
          <span
            className={`text-sm leading-relaxed transition-colors ${
              completed.has(i)
                ? 'line-through text-gray-400 dark:text-gray-500'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ─── Renewal Warning ──────────────────────────────────────────────────────────

function RenewalWarning({ sub }: { sub: Subscription }) {
  const days = daysUntil(sub.renewalDate);
  const cost = formatCost(sub.cost, sub.currency);
  const date = formatDate(sub.renewalDate);

  const urgency =
    days <= 0
      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-800 dark:text-red-300'
      : days <= 3
      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 text-orange-800 dark:text-orange-300'
      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300';

  const message =
    days <= 0
      ? `This subscription renewed ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago.`
      : days === 0
      ? 'This subscription renews today.'
      : `This subscription renews in ${days} day${days !== 1 ? 's' : ''} on ${date}.`;

  return (
    <div role="alert" className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-sm ${urgency}`}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="shrink-0 mt-0.5" aria-hidden="true">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      <div>
        <span className="font-medium">{message}</span>
        <span className="ml-1">Cancel before then to avoid a {cost} charge.</span>
      </div>
    </div>
  );
}

// ─── Pro Auto-Highlight Toggle (Req 8.4) ─────────────────────────────────────

interface ProHighlightToggleProps {
  sub: Subscription;
  cancelUrl: string | undefined;
}

function ProHighlightToggle({ sub, cancelUrl }: ProHighlightToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleToggle = useCallback(async (checked: boolean) => {
    setEnabled(checked);
    if (!checked || !cancelUrl) return;

    setStatus('sending');
    try {
      // Find the tab that has the cancel URL open, or send to the active tab
      const tabs = await browser.tabs.query({ url: `${new URL(cancelUrl).origin}/*` });
      const targetTab = tabs[0];
      if (!targetTab?.id) {
        setStatus('error');
        return;
      }
      // Send message directly to the content script on that tab
      await browser.tabs.sendMessage(targetTab.id, {
        type: 'HIGHLIGHT_CANCEL_BUTTON',
        payload: { cancelUrl },
      });
      setStatus('sent');
    } catch (err) {
      console.warn('[CancelHelper] Could not send highlight message:', err);
      setStatus('error');
    }
  }, [cancelUrl]);

  // Dismiss status after 3s
  useEffect(() => {
    if (status === 'sent' || status === 'error') {
      const t = setTimeout(() => setStatus('idle'), 3000);
      return () => clearTimeout(t);
    }
  }, [status]);

  void sub; // used for context; cancelUrl drives the action

  return (
    <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Auto-highlight cancel button</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Highlights the cancel button on the service page when you open it.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle auto-highlight cancel button"
          onClick={() => handleToggle(!enabled)}
          disabled={!cancelUrl}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed ${
            enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {status === 'sent' && (
        <p className="mt-2 text-xs text-green-600 dark:text-green-400">Highlight signal sent to the page.</p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-xs text-red-500 dark:text-red-400">
          Could not reach the page. Make sure the cancel page is open in a tab.
        </p>
      )}
    </div>
  );
}

// ─── CancelHelper ─────────────────────────────────────────────────────────────

export default function CancelHelper() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { show } = useToastContext();

  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [found] = await Promise.all([
        getSubscription(id),
      ]);
      if (!found) {
        show('Subscription not found.', 'error');
        navigate('/');
        return;
      }
      setSub(found);
    } catch (err) {
      console.error('[CancelHelper] Failed to load:', err);
      show('Failed to load subscription.', 'error');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, show]);

  useEffect(() => { load(); }, [load]);

  const handleMarkCancelled = useCallback(async () => {
    if (!sub) return;
    setMarking(true);
    try {
      await updateSubscription(sub.id, { status: 'cancelled' });
      // Cancel the renewal alarm via Service Worker
      await sendMessage('CANCEL_ALARM', { subscriptionId: sub.id });
      show(`"${sub.customName ?? sub.service}" marked as cancelled.`, 'success');
      navigate('/');
    } catch (err) {
      console.error('[CancelHelper] Failed to mark cancelled:', err);
      show('Failed to update subscription status.', 'error');
    } finally {
      setMarking(false);
      setConfirmCancel(false);
    }
  }, [sub, navigate, show]);

  const handleOpenCancelPage = useCallback(() => {
    if (!sub) return;
    const catalogEntry = SERVICE_CATALOG_BY_KEY[sub.service];
    const url = sub.cancelUrl ?? catalogEntry?.defaultCancelUrl;
    if (url) {
      browser.tabs.create({ url });
    }
  }, [sub]);

  if (loading) {
    return (
      <div className="p-4 space-y-3" aria-busy="true" aria-label="Loading cancel helper">
        <div className="h-8 w-48 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-16 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-40 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    );
  }

  if (!sub) return null;

  const catalogEntry = SERVICE_CATALOG_BY_KEY[sub.service];
  const displayName = sub.customName ?? catalogEntry?.name ?? sub.service;
  const cancelUrl = sub.cancelUrl ?? catalogEntry?.defaultCancelUrl;
  const steps = SERVICE_STEPS[sub.service] ?? DEFAULT_STEPS;
  const alreadyCancelled = sub.status === 'cancelled';

  return (
    <div className="p-4 max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
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
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Cancel Helper</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{displayName}</p>
        </div>
      </div>

      {/* Already cancelled notice */}
      {alreadyCancelled && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
          This subscription is already marked as cancelled.
        </div>
      )}

      {/* Renewal warning */}
      {!alreadyCancelled && <div className="mb-4"><RenewalWarning sub={sub} /></div>}

      {/* Step-by-step instructions */}
      <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
          How to cancel {displayName}
        </h2>
        <StepList steps={steps} />
      </div>

      {/* Pro auto-highlight — gated behind Pro license */}
      <ProGate featureName="Cancel button auto-highlight">
        <ProHighlightToggle sub={sub} cancelUrl={cancelUrl} />
      </ProGate>

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        {cancelUrl && (
          <button
            onClick={handleOpenCancelPage}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M11 3h6v6M17 3l-9 9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 5H4a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-5" strokeLinecap="round" />
            </svg>
            Open Cancel Page
          </button>
        )}

        {!alreadyCancelled && !confirmCancel && (
          <button
            onClick={() => setConfirmCancel(true)}
            className="w-full px-4 py-2.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Mark as Cancelled
          </button>
        )}

        {/* Confirmation prompt */}
        {confirmCancel && (
          <div className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3">
            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
              Mark <strong>{displayName}</strong> as cancelled? This will remove its renewal reminder.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleMarkCancelled}
                disabled={marking}
                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {marking ? 'Cancelling…' : 'Yes, mark cancelled'}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
