import type { ServiceCatalogEntry, Currency, UserSettings, Category } from './types';

// ─── Schema Version ─────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 1;

// ─── Exchange Rates (USD base, updated each release) ────────────────────────

export const EXCHANGE_RATES_USD_BASE: Record<Currency, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  PKR: 278.5,
  INR: 83.1,
  CAD: 1.36,
  AUD: 1.53,
};

export const EXCHANGE_RATES_UPDATED_AT = '2025-01-01';

// ─── Default Settings ───────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'light',
  currency: 'USD',
  reminderDaysBefore: 3,
  notificationsEnabled: true,
  autoDetectEnabled: true,
  emailScanEnabled: false,
  analyticsOptIn: false,
  proLicense: false,
  onboardingComplete: false,
  firstRunAt: new Date().toISOString(),
};

// ─── Service Catalog (40 entries) ───────────────────────────────────────────

export const SERVICE_CATALOG: ServiceCatalogEntry[] = [
  // Streaming
  {
    key: 'netflix',
    name: 'Netflix',
    domains: ['netflix.com'],
    defaultCategory: 'streaming',
    defaultCancelUrl: 'https://www.netflix.com/cancelplan',
    logoFile: 'netflix.png',
  },
  {
    key: 'spotify',
    name: 'Spotify',
    domains: ['spotify.com'],
    defaultCategory: 'music',
    defaultCancelUrl: 'https://www.spotify.com/account/subscription/cancel',
    logoFile: 'spotify.png',
  },
  {
    key: 'hulu',
    name: 'Hulu',
    domains: ['hulu.com'],
    defaultCategory: 'streaming',
    defaultCancelUrl: 'https://secure.hulu.com/account/cancel',
    logoFile: 'hulu.png',
  },
  {
    key: 'disney-plus',
    name: 'Disney+',
    domains: ['disneyplus.com'],
    defaultCategory: 'streaming',
    defaultCancelUrl: 'https://www.disneyplus.com/account/subscription',
    logoFile: 'disney-plus.png',
  },
  {
    key: 'hbo-max',
    name: 'Max (HBO)',
    domains: ['hbomax.com', 'max.com'],
    defaultCategory: 'streaming',
    defaultCancelUrl: 'https://www.max.com/account/subscription',
    logoFile: 'hbo-max.png',
  },
  {
    key: 'prime-video',
    name: 'Amazon Prime Video',
    domains: ['primevideo.com', 'amazon.com'],
    defaultCategory: 'streaming',
    defaultCancelUrl: 'https://www.amazon.com/mc/pipelines/cancellation',
    logoFile: 'prime-video.png',
  },
  {
    key: 'apple-tv',
    name: 'Apple TV+',
    domains: ['apple.com'],
    defaultCategory: 'streaming',
    defaultCancelUrl: 'https://support.apple.com/en-us/HT202039',
    logoFile: 'apple-tv.png',
  },
  {
    key: 'youtube-premium',
    name: 'YouTube Premium',
    domains: ['youtube.com'],
    defaultCategory: 'streaming',
    defaultCancelUrl: 'https://www.youtube.com/paid_memberships',
    logoFile: 'youtube-premium.png',
  },
  {
    key: 'peacock',
    name: 'Peacock',
    domains: ['peacocktv.com'],
    defaultCategory: 'streaming',
    defaultCancelUrl: 'https://www.peacocktv.com/account/cancel-plan',
    logoFile: 'peacock.png',
  },
  {
    key: 'paramount-plus',
    name: 'Paramount+',
    domains: ['paramountplus.com'],
    defaultCategory: 'streaming',
    defaultCancelUrl: 'https://www.paramountplus.com/account/cancel/',
    logoFile: 'paramount-plus.png',
  },
  {
    key: 'crunchyroll',
    name: 'Crunchyroll',
    domains: ['crunchyroll.com'],
    defaultCategory: 'streaming',
    defaultCancelUrl: 'https://www.crunchyroll.com/account/membership',
    logoFile: 'crunchyroll.png',
  },
  // Cloud Storage / SaaS
  {
    key: 'dropbox',
    name: 'Dropbox',
    domains: ['dropbox.com'],
    defaultCategory: 'cloud',
    defaultCancelUrl: 'https://www.dropbox.com/account/plan',
    logoFile: 'dropbox.png',
  },
  {
    key: 'box',
    name: 'Box',
    domains: ['box.com'],
    defaultCategory: 'cloud',
    defaultCancelUrl: 'https://app.box.com/account',
    logoFile: 'box.png',
  },
  {
    key: 'notion',
    name: 'Notion',
    domains: ['notion.so'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://www.notion.so/my-account',
    logoFile: 'notion.png',
  },
  {
    key: 'evernote',
    name: 'Evernote',
    domains: ['evernote.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://www.evernote.com/Billing.action',
    logoFile: 'evernote.png',
  },
  {
    key: 'slack',
    name: 'Slack',
    domains: ['slack.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://slack.com/intl/en-us/help/articles/203953146',
    logoFile: 'slack.png',
  },
  {
    key: 'zoom',
    name: 'Zoom',
    domains: ['zoom.us'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://support.zoom.us/hc/en-us/articles/203634215',
    logoFile: 'zoom.png',
  },
  {
    key: 'adobe-cc',
    name: 'Adobe Creative Cloud',
    domains: ['adobe.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://account.adobe.com/plans',
    logoFile: 'adobe-cc.png',
  },
  {
    key: 'figma',
    name: 'Figma',
    domains: ['figma.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://www.figma.com/settings',
    logoFile: 'figma.png',
  },
  {
    key: 'canva',
    name: 'Canva Pro',
    domains: ['canva.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://www.canva.com/settings/billing',
    logoFile: 'canva.png',
  },
  {
    key: 'github',
    name: 'GitHub',
    domains: ['github.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://github.com/settings/billing',
    logoFile: 'github.png',
  },
  {
    key: 'atlassian',
    name: 'Atlassian (Jira/Confluence)',
    domains: ['atlassian.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://admin.atlassian.com',
    logoFile: 'atlassian.png',
  },
  {
    key: 'monday',
    name: 'Monday.com',
    domains: ['monday.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://monday.com/account-settings/billing',
    logoFile: 'monday.png',
  },
  {
    key: 'asana',
    name: 'Asana',
    domains: ['asana.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://app.asana.com/-/account_api',
    logoFile: 'asana.png',
  },
  {
    key: 'trello',
    name: 'Trello',
    domains: ['trello.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://trello.com/billing',
    logoFile: 'trello.png',
  },
  // Education
  {
    key: 'duolingo',
    name: 'Duolingo Plus',
    domains: ['duolingo.com'],
    defaultCategory: 'education',
    defaultCancelUrl: 'https://www.duolingo.com/settings/super',
    logoFile: 'duolingo.png',
  },
  {
    key: 'coursera',
    name: 'Coursera Plus',
    domains: ['coursera.org'],
    defaultCategory: 'education',
    defaultCancelUrl: 'https://www.coursera.org/account-profile',
    logoFile: 'coursera.png',
  },
  {
    key: 'udemy',
    name: 'Udemy',
    domains: ['udemy.com'],
    defaultCategory: 'education',
    defaultCancelUrl: 'https://www.udemy.com/user/edit-account/',
    logoFile: 'udemy.png',
  },
  {
    key: 'skillshare',
    name: 'Skillshare',
    domains: ['skillshare.com'],
    defaultCategory: 'education',
    defaultCancelUrl: 'https://www.skillshare.com/settings/membership',
    logoFile: 'skillshare.png',
  },
  {
    key: 'masterclass',
    name: 'MasterClass',
    domains: ['masterclass.com'],
    defaultCategory: 'education',
    defaultCancelUrl: 'https://www.masterclass.com/account/membership',
    logoFile: 'masterclass.png',
  },
  // Fitness / Wellness
  {
    key: 'peloton',
    name: 'Peloton',
    domains: ['peloton.com'],
    defaultCategory: 'fitness',
    defaultCancelUrl: 'https://members.onepeloton.com/profile/membership',
    logoFile: 'peloton.png',
  },
  {
    key: 'calm',
    name: 'Calm',
    domains: ['calm.com'],
    defaultCategory: 'fitness',
    defaultCancelUrl: 'https://www.calm.com/account',
    logoFile: 'calm.png',
  },
  {
    key: 'headspace',
    name: 'Headspace',
    domains: ['headspace.com'],
    defaultCategory: 'fitness',
    defaultCancelUrl: 'https://www.headspace.com/account',
    logoFile: 'headspace.png',
  },
  // News / Reading
  {
    key: 'nytimes',
    name: 'New York Times',
    domains: ['nytimes.com'],
    defaultCategory: 'other',
    defaultCancelUrl: 'https://myaccount.nytimes.com/seg/subscription',
    logoFile: 'nytimes.png',
  },
  {
    key: 'wsj',
    name: 'Wall Street Journal',
    domains: ['wsj.com'],
    defaultCategory: 'other',
    defaultCancelUrl: 'https://store.wsj.com/shop/wsjus/cancelsubscription',
    logoFile: 'wsj.png',
  },
  {
    key: 'medium',
    name: 'Medium',
    domains: ['medium.com'],
    defaultCategory: 'other',
    defaultCancelUrl: 'https://medium.com/me/membership',
    logoFile: 'medium.png',
  },
  // Productivity / Security
  {
    key: 'grammarly',
    name: 'Grammarly',
    domains: ['grammarly.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://account.grammarly.com/subscription',
    logoFile: 'grammarly.png',
  },
  {
    key: 'lastpass',
    name: 'LastPass',
    domains: ['lastpass.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://lastpass.com/account.php',
    logoFile: 'lastpass.png',
  },
  {
    key: '1password',
    name: '1Password',
    domains: ['1password.com'],
    defaultCategory: 'saas',
    defaultCancelUrl: 'https://my.1password.com/profile',
    logoFile: '1password.png',
  },
  // AI
  {
    key: 'chatgpt-plus',
    name: 'ChatGPT Plus',
    domains: ['chat.openai.com', 'chatgpt.com'],
    defaultCategory: 'ai',
    defaultCancelUrl: 'https://chat.openai.com/account/billing',
    logoFile: 'chatgpt-plus.png',
  },
];

// ─── Catalog lookup helpers ──────────────────────────────────────────────────

export const SERVICE_CATALOG_BY_KEY: Record<string, ServiceCatalogEntry> =
  Object.fromEntries(SERVICE_CATALOG.map((e) => [e.key, e]));

/** All domains across the entire catalog (for content script matching) */
export const ALL_CATALOG_DOMAINS: string[] = SERVICE_CATALOG.flatMap((e) => e.domains);

/** All valid categories */
export const ALL_CATEGORIES: Category[] = [
  'streaming',
  'saas',
  'fitness',
  'food',
  'music',
  'cloud',
  'ai',
  'education',
  'other',
];
