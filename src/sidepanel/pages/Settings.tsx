import { useState, useEffect, useCallback, useRef } from 'react';
import { getSettings, setSettings, getLicense, setLicense } from '../../shared/storage';
import { getAllSubscriptions, addSubscription, db } from '../../shared/db';
import { validateLicense } from '../../shared/licenseService';
import { isDuplicate, validateSubscription } from '../../shared/utils';
import { useToastContext } from '../context/ToastContext';
import { useOnlineContext } from '../context/OnlineContext';
import { ProGate } from '../components/ProGate';
import browser from '../../shared/browser';
import type { UserSettings, LicenseInfo, Currency, Subscription } from '../../shared/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'PKR', 'INR', 'CAD', 'AUD'];

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
      {children}
    </h2>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 mb-4">
      {children}
    </div>
  );
}

function SettingsRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 px-4 py-3">{children}</div>;
}

function RowLabel({ label, description }: { label: string; description?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{label}</p>
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      )}
    </div>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}

function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  'id', 'service', 'customName', 'cost', 'currency', 'billingCycle',
  'renewalDate', 'status', 'category', 'website', 'notes', 'cancelUrl',
  'detectedFrom', 'lastUsed', 'resumeDate', 'createdAt', 'updatedAt',
] as const;

type CsvColumn = typeof CSV_COLUMNS[number];

function escapeCsv(value: string | number | undefined | null): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function subscriptionsToCsv(subs: Subscription[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = subs.map((s) =>
    CSV_COLUMNS.map((col) => escapeCsv(s[col as CsvColumn] as string | number | undefined)).join(',')
  );
  return [header, ...rows].join('\n');
}

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function csvToSubscriptions(csv: string): { valid: Partial<Subscription>[]; errors: number } {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return { valid: [], errors: 0 };

  const headers = parseCsvRow(lines[0]);
  let errors = 0;
  const valid: Partial<Subscription>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? ''; });

    const candidate: Partial<Subscription> = {
      service: obj.service || undefined,
      customName: obj.customName || undefined,
      cost: obj.cost ? parseFloat(obj.cost) : undefined,
      currency: (obj.currency as Subscription['currency']) || undefined,
      billingCycle: (obj.billingCycle as Subscription['billingCycle']) || undefined,
      renewalDate: obj.renewalDate || undefined,
      status: (obj.status as Subscription['status']) || undefined,
      category: (obj.category as Subscription['category']) || undefined,
      website: obj.website || undefined,
      notes: obj.notes || undefined,
      cancelUrl: obj.cancelUrl || undefined,
      detectedFrom: obj.detectedFrom || undefined,
      lastUsed: obj.lastUsed || undefined,
      resumeDate: obj.resumeDate || undefined,
    };

    const result = validateSubscription(candidate);
    if (result.errors.length > 0) { errors++; continue; }
    valid.push(candidate);
  }

  return { valid, errors };
}

// ─── Settings Page ────────────────────────────────────────────────────────────

export default function Settings() {
  const { show } = useToastContext();
  const isOnline = useOnlineContext();

  const [settings, setLocalSettings] = useState<UserSettings | null>(null);
  const [license, setLocalLicense] = useState<LicenseInfo | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [validating, setValidating] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const [cfg, lic] = await Promise.all([getSettings(), getLicense()]);
    setLocalSettings(cfg);
    setLocalLicense(lic);
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Persist a settings change ─────────────────────────────────────────────

  const update = useCallback(async (partial: Partial<UserSettings>) => {
    setLocalSettings((prev) => prev ? { ...prev, ...partial } : prev);
    try {
      await setSettings(partial);
    } catch (err) {
      console.error('[Settings] Failed to save settings:', err);
      show('Failed to save settings.', 'error');
    }
  }, [show]);

  // ── Notifications toggle with permission request ───────────────────────────

  const handleNotificationsToggle = useCallback(async (enabled: boolean) => {
    if (enabled) {
      if (typeof Notification === 'undefined') {
        show('Notifications are not supported in this browser.', 'error');
        return;
      }
      if (Notification.permission === 'denied') {
        show('Notification permission was denied. Please enable it in browser settings.', 'warning');
        await update({ notificationsEnabled: false });
        return;
      }
      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission();
        setNotifPermission(result);
        if (result !== 'granted') {
          show('Notification permission denied.', 'warning');
          await update({ notificationsEnabled: false });
          return;
        }
      }
    }
    await update({ notificationsEnabled: enabled });
  }, [update, show]);

  // ── License validation ────────────────────────────────────────────────────

  const handleValidateLicense = useCallback(async () => {
    const key = licenseKey.trim();
    if (!key) { show('Please enter a license key.', 'warning'); return; }
    setValidating(true);
    try {
      const result = await validateLicense(key);
      if (result.isValid && result.license) {
        setLocalLicense(result.license);
        setLocalSettings((prev) => prev ? { ...prev, proLicense: true } : prev);
        show('Pro license activated!', 'success');
        setLicenseKey('');
      } else {
        show(result.error ?? 'Invalid license key.', 'error');
      }
    } catch (err) {
      show('Failed to validate license. Check your connection.', 'error');
      console.error('[Settings] License validation error:', err);
    } finally {
      setValidating(false);
    }
  }, [licenseKey, show]);

  const handleRemoveLicense = useCallback(async () => {
    await setLicense(null);
    await update({ proLicense: false });
    setLocalLicense(null);
    show('Pro license removed.', 'info');
  }, [update, show]);

  // ── CSV Export ────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    try {
      const subs = await getAllSubscriptions();
      const csv = subscriptionsToCsv(subs);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subguard-export-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      show(`Exported ${subs.length} subscription${subs.length !== 1 ? 's' : ''}.`, 'success');
    } catch (err) {
      console.error('[Settings] Export failed:', err);
      show('Export failed. Please try again.', 'error');
    }
  }, [show]);

  // ── CSV Import ────────────────────────────────────────────────────────────

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';

    const text = await file.text();
    const { valid, errors } = csvToSubscriptions(text);

    const existing = await getAllSubscriptions();
    let imported = 0;
    let skipped = 0;

    for (const candidate of valid) {
      if (isDuplicate(candidate as Subscription, existing)) {
        skipped++;
        continue;
      }
      const now = new Date().toISOString();
      const full: Subscription = {
        id: crypto.randomUUID(),
        service: candidate.service!,
        customName: candidate.customName,
        cost: candidate.cost!,
        currency: candidate.currency!,
        billingCycle: candidate.billingCycle!,
        renewalDate: candidate.renewalDate!,
        status: candidate.status ?? 'active',
        category: candidate.category ?? 'other',
        website: candidate.website,
        notes: candidate.notes,
        cancelUrl: candidate.cancelUrl,
        detectedFrom: candidate.detectedFrom,
        lastUsed: candidate.lastUsed,
        resumeDate: candidate.resumeDate,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await addSubscription(full);
        existing.push(full);
        imported++;
      } catch {
        skipped++;
      }
    }

    const parts = [`Imported: ${imported}`];
    if (skipped > 0) parts.push(`Skipped: ${skipped}`);
    if (errors > 0) parts.push(`Errors: ${errors}`);
    show(parts.join(' · '), imported > 0 ? 'success' : 'warning');
  }, [show]);

  // ── Delete All Data ───────────────────────────────────────────────────────

  const handleDeleteAll = useCallback(async () => {
    setDeleting(true);
    try {
      await db.subscriptions.clear();
      await browser.storage.local.clear();
      await browser.alarms.clearAll();
      show('All data deleted.', 'info');
      setShowDeleteConfirm(false);
      // Reload settings to defaults
      await load();
    } catch (err) {
      console.error('[Settings] Delete all failed:', err);
      show('Failed to delete all data.', 'error');
    } finally {
      setDeleting(false);
    }
  }, [show, load]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!settings) {
    return (
      <div className="p-4 space-y-3" aria-busy="true" aria-label="Loading settings">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  const isPro = settings.proLicense || (license?.isValid ?? false);

  return (
    <div className="p-4 max-w-lg">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Settings</h1>
        {isPro && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600 text-white font-semibold tracking-wide">
            PRO
          </span>
        )}
      </div>

      {/* ── Appearance ── */}
      <SectionTitle>Appearance</SectionTitle>
      <SettingsCard>
        <SettingsRow>
          <RowLabel label="Theme" description="Light or dark mode" />
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => update({ theme: t })}
                aria-pressed={settings.theme === t}
                className={`px-3 py-1 text-xs rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  settings.theme === t
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsCard>

      {/* ── Currency & Reminders ── */}
      <SectionTitle>Currency & Reminders</SectionTitle>
      <SettingsCard>
        <SettingsRow>
          <RowLabel label="Display Currency" description="All spend totals shown in this currency" />
          <select
            value={settings.currency}
            onChange={(e) => update({ currency: e.target.value as Currency })}
            aria-label="Display currency"
            className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow>
          <RowLabel label="Reminder Days Before" description="How many days before renewal to notify you (1–30)" />
          <input
            type="number"
            min={1}
            max={30}
            value={settings.reminderDaysBefore}
            onChange={(e) => {
              const v = Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 1));
              update({ reminderDaysBefore: v });
            }}
            aria-label="Reminder days before renewal"
            className="w-16 text-sm text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </SettingsRow>
      </SettingsCard>

      {/* ── Notifications & Detection ── */}
      <SectionTitle>Notifications & Detection</SectionTitle>
      <SettingsCard>
        <SettingsRow>
          <RowLabel
            label="Renewal Notifications"
            description={
              notifPermission === 'denied'
                ? 'Permission denied — enable in browser settings'
                : 'Get notified before subscriptions renew'
            }
          />
          <Toggle
            checked={settings.notificationsEnabled && notifPermission !== 'denied'}
            onChange={handleNotificationsToggle}
            label="Toggle renewal notifications"
            disabled={notifPermission === 'denied'}
          />
        </SettingsRow>
        <SettingsRow>
          <RowLabel label="Auto-Detection" description="Detect subscriptions while browsing" />
          <Toggle
            checked={settings.autoDetectEnabled}
            onChange={(v) => update({ autoDetectEnabled: v })}
            label="Toggle auto-detection"
          />
        </SettingsRow>
        <div className="px-4 py-3">
          <ProGate
            featureName="Email Scan"
            fallback={
              <SettingsRow>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Email Scan</p>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-medium">
                      Pro
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Upgrade to Pro to enable email scanning
                  </p>
                </div>
                <Toggle
                  checked={false}
                  onChange={() => {}}
                  label="Toggle email scan"
                  disabled
                />
              </SettingsRow>
            }
          >
            <SettingsRow>
              <RowLabel label="Email Scan" description={!isOnline ? 'Unavailable while offline' : 'Scan Gmail for subscription receipts'} />
              <Toggle
                checked={settings.emailScanEnabled}
                onChange={(v) => update({ emailScanEnabled: v })}
                label="Toggle email scan"
                disabled={!isOnline}
              />
            </SettingsRow>
          </ProGate>
        </div>
      </SettingsCard>

      {/* ── Privacy ── */}
      <SectionTitle>Privacy</SectionTitle>
      <SettingsCard>
        <SettingsRow>
          <RowLabel
            label="Analytics Opt-In"
            description="Share anonymous usage data to help improve SubGuard (disabled by default)"
          />
          <Toggle
            checked={settings.analyticsOptIn}
            onChange={(v) => update({ analyticsOptIn: v })}
            label="Toggle analytics opt-in"
          />
        </SettingsRow>
      </SettingsCard>

      {/* ── License ── */}
      <SectionTitle>License</SectionTitle>
      <SettingsCard>
        {isPro && license ? (
          <SettingsRow>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Pro Active</p>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-medium">
                  {license.type === 'lifetime' ? 'Lifetime' : 'Monthly'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{license.email}</p>
            </div>
            <button
              onClick={handleRemoveLicense}
              className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
            >
              Remove
            </button>
          </SettingsRow>
        ) : (
          <div className="px-4 py-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-50 mb-2">Activate Pro License</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleValidateLicense()}
                placeholder="Enter license key"
                aria-label="License key"
                className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
              />
              <button
                onClick={handleValidateLicense}
                disabled={validating || !licenseKey.trim() || !isOnline}
                title={!isOnline ? 'Unavailable while offline' : undefined}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-1.5"
              >
                {validating && (
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {validating ? 'Validating…' : 'Validate'}
              </button>
            </div>
          </div>
        )}
      </SettingsCard>

      {/* ── Data Management ── */}
      <SectionTitle>Data Management</SectionTitle>
      <SettingsCard>
        <div className="px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Expected CSV columns: {CSV_COLUMNS.join(', ')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Export CSV
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Import CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportFile}
              className="sr-only"
              aria-label="Import CSV file"
            />
          </div>
        </div>
      </SettingsCard>

      {/* ── Danger Zone ── */}
      <SectionTitle>Danger Zone</SectionTitle>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-4 mb-4">
        {!showDeleteConfirm ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Delete All Data</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Permanently removes all subscriptions, settings, and license data.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="shrink-0 px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Delete All
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
              This will permanently delete all your subscriptions, settings, and license data. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
