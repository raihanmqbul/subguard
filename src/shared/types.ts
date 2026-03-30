// ─── Union Types ────────────────────────────────────────────────────────────

export type BillingCycle = 'monthly' | 'yearly' | 'weekly' | 'quarterly' | 'lifetime';

export type SubscriptionStatus = 'active' | 'cancelled' | 'paused' | 'trial';

export type Category =
  | 'streaming'
  | 'saas'
  | 'fitness'
  | 'food'
  | 'music'
  | 'cloud'
  | 'ai'
  | 'education'
  | 'other';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'PKR' | 'INR' | 'CAD' | 'AUD';

// ─── Core Entities ──────────────────────────────────────────────────────────

export interface Subscription {
  id: string;                   // uuid v4
  service: string;              // catalog key or custom name
  customName?: string;
  cost: number;                 // stored in original currency
  currency: Currency;
  billingCycle: BillingCycle;
  renewalDate: string;          // ISO 8601 date string
  status: SubscriptionStatus;
  category: Category;
  website?: string;
  logoKey?: string;             // matches filename in public/service-logos/
  notes?: string;
  detectedFrom?: string;        // source domain if auto-detected
  lastUsed?: string;            // ISO 8601 date string
  cancelUrl?: string;
  resumeDate?: string;          // ISO 8601; for paused subscriptions
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}

export interface UserSettings {
  theme: 'light' | 'dark';
  currency: Currency;
  reminderDaysBefore: number;   // 1–30, default 3
  notificationsEnabled: boolean;
  autoDetectEnabled: boolean;
  emailScanEnabled: boolean;    // Pro only
  analyticsOptIn: boolean;      // default false
  proLicense: boolean;
  onboardingComplete: boolean;
  firstRunAt: string;           // ISO 8601
}

export interface LicenseInfo {
  key: string;
  type: 'monthly' | 'lifetime';
  validatedAt: string;          // ISO 8601
  expiresAt?: string;           // ISO 8601; null for lifetime
  email: string;
  isValid: boolean;
  lastRevalidationAttempt?: string; // ISO 8601
  gracePeriodStart?: string;    // ISO 8601; set when API is unreachable
}

// ─── Computed / Derived ─────────────────────────────────────────────────────

export interface UpcomingRenewal {
  subscriptionId: string;
  service: string;
  renewalDate: string;
  cost: number;
  currency: Currency;
  convertedCost: number;        // in display currency
  isTrial: boolean;
}

export interface SpendStats {
  monthlyTotal: number;         // in display currency
  annualProjection: number;     // in display currency
  activeCount: number;
  cancelledCount: number;
  trialCount: number;
  pausedCount: number;
  upcomingRenewals: UpcomingRenewal[];
  byCategory: Record<Category, number>;
  currency: Currency;
  isApproximate: boolean;       // true when multi-currency conversion applied
}

// ─── Service Catalog ────────────────────────────────────────────────────────

export interface ServiceCatalogEntry {
  key: string;                  // unique identifier, matches logoKey
  name: string;
  domains: string[];            // for content script matching
  defaultCategory: Category;
  defaultCancelUrl: string;
  logoFile: string;             // filename in public/service-logos/
}
