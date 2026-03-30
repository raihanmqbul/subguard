import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addSubscription, updateSubscription, getAllSubscriptions, getSubscription } from '../../shared/db';
import { getSettings } from '../../shared/storage';
import { validateSubscription, isDuplicate } from '../../shared/utils';
import { scheduleRenewalAlarm, cancelAlarm } from '../../background/alarms';
import { SERVICE_CATALOG, ALL_CATEGORIES } from '../../shared/constants';
import { useToastContext } from '../context/ToastContext';
import { useProLicense } from '../hooks/useProLicense';
import type { Subscription, BillingCycle, Currency, Category, SubscriptionStatus } from '../../shared/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const BILLING_CYCLES: BillingCycle[] = ['monthly', 'yearly', 'weekly', 'quarterly', 'lifetime'];
const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'PKR', 'INR', 'CAD', 'AUD'];
const STATUSES: SubscriptionStatus[] = ['active', 'trial', 'paused', 'cancelled'];

// ─── Form State ───────────────────────────────────────────────────────────────

interface FormState {
  service: string;
  customName: string;
  cost: string;
  currency: Currency;
  billingCycle: BillingCycle;
  renewalDate: string;
  category: Category;
  status: SubscriptionStatus;
  website: string;
  notes: string;
  cancelUrl: string;
  resumeDate: string;
}

const DEFAULT_FORM: FormState = {
  service: '',
  customName: '',
  cost: '',
  currency: 'USD',
  billingCycle: 'monthly',
  renewalDate: '',
  category: 'other',
  status: 'active',
  website: '',
  notes: '',
  cancelUrl: '',
  resumeDate: '',
};

// ─── Service Autocomplete ─────────────────────────────────────────────────────

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (key: string, name: string, category: Category, website: string, cancelUrl: string) => void;
  error?: string;
  disabled?: boolean;
}

function ServiceAutocomplete({ value, onChange, onSelect, error, disabled }: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = value.trim().length > 0
    ? SERVICE_CATALOG.filter((e) =>
        e.name.toLowerCase().includes(value.toLowerCase()) ||
        e.key.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 6)
    : [];

  const handleSelect = (entry: typeof SERVICE_CATALOG[0]) => {
    onSelect(entry.key, entry.name, entry.defaultCategory, entry.domains[0] ? `https://${entry.domains[0]}` : '', entry.defaultCancelUrl);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, matches.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && matches[highlighted]) { e.preventDefault(); handleSelect(matches[highlighted]); }
    if (e.key === 'Escape') setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        id="service"
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(0); }}
        onFocus={() => value.trim().length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="e.g. Netflix, Spotify…"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open && matches.length > 0}
        aria-haspopup="listbox"
        aria-invalid={!!error}
        aria-describedby={error ? 'service-error' : undefined}
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
          error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      {open && matches.length > 0 && (
        <ul
          role="listbox"
          aria-label="Service suggestions"
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
        >
          {matches.map((entry, i) => (
            <li
              key={entry.key}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={() => handleSelect(entry)}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                i === highlighted
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span className="font-medium">{entry.name}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{entry.defaultCategory}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Field Components ─────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, htmlFor, error, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {label}{required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function inputClass(error?: string) {
  return `w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
    error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`;
}

function selectClass(error?: string) {
  return `w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
    error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`;
}

// ─── Duplicate Warning Dialog ─────────────────────────────────────────────────

interface DuplicateDialogProps {
  serviceName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DuplicateDialog({ serviceName, onConfirm, onCancel }: DuplicateDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dup-title"
      aria-describedby="dup-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 max-w-sm w-full">
        <h2 id="dup-title" className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-2">
          Duplicate subscription detected
        </h2>
        <p id="dup-desc" className="text-xs text-gray-600 dark:text-gray-400 mb-4">
          A subscription for <strong>{serviceName}</strong> with the same renewal date already exists. Add it anyway?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          >
            Add anyway
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SubscriptionForm ─────────────────────────────────────────────────────────

export default function SubscriptionForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { show } = useToastContext();
  const { isPro } = useProLicense();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  // Load existing subscription for edit mode
  useEffect(() => {
    if (!id) return;
    getSubscription(id).then((sub) => {
      if (!sub) { navigate('/'); return; }
      setForm({
        service: sub.service,
        customName: sub.customName ?? '',
        cost: String(sub.cost),
        currency: sub.currency,
        billingCycle: sub.billingCycle,
        renewalDate: sub.renewalDate.slice(0, 10), // YYYY-MM-DD for date input
        category: sub.category,
        status: sub.status,
        website: sub.website ?? '',
        notes: sub.notes ?? '',
        cancelUrl: sub.cancelUrl ?? '',
        resumeDate: sub.resumeDate ? sub.resumeDate.slice(0, 10) : '',
      });
      setLoading(false);
    }).catch(() => { navigate('/'); });
  }, [id, navigate]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }, []);

  const handleServiceSelect = useCallback((
    _key: string,
    name: string,
    category: Category,
    website: string,
    cancelUrl: string,
  ) => {
    // Smart categorization (Pro feature, Req 9.10):
    // Auto-assign category from catalog when Pro is active.
    // Free users keep their manually selected category.
    setForm((prev) => ({
      ...prev,
      service: name,
      website,
      cancelUrl,
      ...(isPro ? { category } : {}),
    }));
    setErrors((prev) => { const next = { ...prev }; delete next.service; return next; });
  }, [isPro]);

  const buildSubscription = useCallback((overrideId?: string): Subscription => {
    const now = new Date().toISOString();
    return {
      id: overrideId ?? crypto.randomUUID(),
      service: form.service.trim(),
      customName: form.customName.trim() || undefined,
      cost: parseFloat(form.cost),
      currency: form.currency,
      billingCycle: form.billingCycle,
      renewalDate: new Date(form.renewalDate).toISOString(),
      status: form.status,
      category: form.category,
      website: form.website.trim() || undefined,
      notes: form.notes.trim() || undefined,
      cancelUrl: form.cancelUrl.trim() || undefined,
      resumeDate: form.resumeDate ? new Date(form.resumeDate).toISOString() : undefined,
      createdAt: now,
      updatedAt: now,
    };
  }, [form]);

  const validate = useCallback((): boolean => {
    const partial = {
      service: form.service.trim(),
      cost: parseFloat(form.cost),
      currency: form.currency,
      billingCycle: form.billingCycle,
      renewalDate: form.renewalDate ? new Date(form.renewalDate).toISOString() : '',
      status: form.status,
    };
    const result = validateSubscription(partial);
    if (!result.valid) {
      const map: Record<string, string> = {};
      for (const e of result.errors) map[e.field] = e.message;
      setErrors(map);
      return false;
    }
    setErrors({});
    return true;
  }, [form]);

  const doSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const settings = await getSettings();
      if (isEdit && id) {
        const changes: Partial<Subscription> = {
          service: form.service.trim(),
          customName: form.customName.trim() || undefined,
          cost: parseFloat(form.cost),
          currency: form.currency,
          billingCycle: form.billingCycle,
          renewalDate: new Date(form.renewalDate).toISOString(),
          status: form.status,
          category: form.category,
          website: form.website.trim() || undefined,
          notes: form.notes.trim() || undefined,
          cancelUrl: form.cancelUrl.trim() || undefined,
          resumeDate: form.resumeDate ? new Date(form.resumeDate).toISOString() : undefined,
        };
        await updateSubscription(id, changes);
        // Re-schedule alarm: cancel old, schedule new if active/trial
        cancelAlarm(id);
        if (form.status === 'active' || form.status === 'trial') {
          const updated = await getSubscription(id);
          if (updated) scheduleRenewalAlarm(updated, settings.reminderDaysBefore);
        }
        show('Subscription updated.', 'success');
      } else {
        const sub = buildSubscription();
        await addSubscription(sub);
        if (sub.status === 'active' || sub.status === 'trial') {
          scheduleRenewalAlarm(sub, settings.reminderDaysBefore);
        }
        show('Subscription added.', 'success');
      }
      navigate('/');
    } catch (err) {
      console.error('[SubscriptionForm] Save failed:', err);
      show('Failed to save subscription. Please try again.', 'error', {
        label: 'Retry',
        onClick: () => doSave(),
      });
    } finally {
      setSubmitting(false);
    }
  }, [form, isEdit, id, buildSubscription, navigate, show]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Duplicate check (only for new subscriptions)
    if (!isEdit) {
      const existing = await getAllSubscriptions();
      const candidate = { service: form.service.trim(), renewalDate: new Date(form.renewalDate).toISOString() };
      if (isDuplicate(candidate, existing)) {
        setShowDuplicate(true);
        return;
      }
    }

    await doSave();
  }, [validate, isEdit, form, doSave]);

  if (loading) {
    return (
      <div className="p-4 space-y-3" aria-busy="true" aria-label="Loading subscription">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      {showDuplicate && (
        <DuplicateDialog
          serviceName={form.service}
          onConfirm={() => { setShowDuplicate(false); doSave(); }}
          onCancel={() => setShowDuplicate(false)}
        />
      )}

      <div className="p-4">
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">
          {isEdit ? 'Edit Subscription' : 'Add Subscription'}
        </h1>

        <form onSubmit={handleSubmit} noValidate aria-label={isEdit ? 'Edit subscription form' : 'Add subscription form'}>
          <div className="space-y-4">

            {/* Service name — autocomplete */}
            <Field label="Service" htmlFor="service" error={errors.service} required>
              <ServiceAutocomplete
                value={form.service}
                onChange={(v) => set('service', v)}
                onSelect={handleServiceSelect}
                error={errors.service}
                disabled={submitting}
              />
            </Field>

            {/* Custom name */}
            <Field label="Custom name" htmlFor="customName">
              <input
                id="customName"
                type="text"
                value={form.customName}
                onChange={(e) => set('customName', e.target.value)}
                disabled={submitting}
                placeholder="Optional display name"
                className={inputClass()}
              />
            </Field>

            {/* Cost + Currency */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cost" htmlFor="cost" error={errors.cost} required>
                <input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => set('cost', e.target.value)}
                  disabled={submitting}
                  placeholder="0.00"
                  aria-invalid={!!errors.cost}
                  aria-describedby={errors.cost ? 'cost-error' : undefined}
                  className={inputClass(errors.cost)}
                />
              </Field>
              <Field label="Currency" htmlFor="currency" error={errors.currency} required>
                <select
                  id="currency"
                  value={form.currency}
                  onChange={(e) => set('currency', e.target.value as Currency)}
                  disabled={submitting}
                  aria-invalid={!!errors.currency}
                  className={selectClass(errors.currency)}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            {/* Billing cycle */}
            <Field label="Billing cycle" htmlFor="billingCycle" error={errors.billingCycle} required>
              <select
                id="billingCycle"
                value={form.billingCycle}
                onChange={(e) => set('billingCycle', e.target.value as BillingCycle)}
                disabled={submitting}
                aria-invalid={!!errors.billingCycle}
                aria-describedby={errors.billingCycle ? 'billingCycle-error' : undefined}
                className={selectClass(errors.billingCycle)}
              >
                {BILLING_CYCLES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </Field>

            {/* Renewal date */}
            <Field label="Renewal date" htmlFor="renewalDate" error={errors.renewalDate} required>
              <input
                id="renewalDate"
                type="date"
                value={form.renewalDate}
                onChange={(e) => set('renewalDate', e.target.value)}
                disabled={submitting}
                aria-invalid={!!errors.renewalDate}
                aria-describedby={errors.renewalDate ? 'renewalDate-error' : undefined}
                className={inputClass(errors.renewalDate)}
              />
            </Field>

            {/* Category */}
            <Field label="Category" htmlFor="category">
              <div className="relative">
                <select
                  id="category"
                  value={form.category}
                  onChange={(e) => set('category', e.target.value as Category)}
                  disabled={submitting}
                  className={selectClass()}
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
                {isPro && (
                  <span
                    className="absolute right-8 top-1/2 -translate-y-1/2 text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 pointer-events-none"
                    title="Smart categorization: category auto-assigned from service catalog (Pro)"
                  >
                    Auto
                  </span>
                )}
              </div>
              {isPro && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Category auto-assigned from service catalog. You can override it.
                </p>
              )}
            </Field>

            {/* Status */}
            <Field label="Status" htmlFor="status">
              <select
                id="status"
                value={form.status}
                onChange={(e) => set('status', e.target.value as SubscriptionStatus)}
                disabled={submitting}
                className={selectClass()}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </Field>

            {/* Resume date — optional, shown when status is paused (Req 24.4) */}
            {form.status === 'paused' && (
              <Field label="Resume date (optional)" htmlFor="resumeDate">
                <input
                  id="resumeDate"
                  type="date"
                  value={form.resumeDate}
                  onChange={(e) => set('resumeDate', e.target.value)}
                  disabled={submitting}
                  className={inputClass()}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Set a date to remind yourself to resume this subscription.
                </p>
              </Field>
            )}

            {/* Website */}
            <Field label="Website" htmlFor="website">
              <input
                id="website"
                type="url"
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                disabled={submitting}
                placeholder="https://example.com"
                className={inputClass()}
              />
            </Field>

            {/* Notes */}
            <Field label="Notes" htmlFor="notes">
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                disabled={submitting}
                rows={2}
                placeholder="Optional notes…"
                className={`${inputClass()} resize-none`}
              />
            </Field>

            {/* Cancel URL */}
            <Field label="Cancel URL" htmlFor="cancelUrl">
              <input
                id="cancelUrl"
                type="url"
                value={form.cancelUrl}
                onChange={(e) => set('cancelUrl', e.target.value)}
                disabled={submitting}
                placeholder="https://example.com/cancel"
                className={inputClass()}
              />
            </Field>

          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={submitting}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add subscription'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
