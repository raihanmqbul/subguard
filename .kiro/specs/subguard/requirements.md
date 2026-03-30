# Requirements Document

## Introduction

SubGuard is a browser extension (Chrome-first, cross-browser compatible) that gives users a unified dashboard to track, manage, and cancel paid subscriptions. It operates entirely client-side — all data is stored in `chrome.storage.local` and IndexedDB — with no mandatory cloud account. The extension supports a Freemium model: a free tier with manual management and a Pro tier ($19 one-time lifetime or $4.99/month) that unlocks email scanning, AI recommendations, and advanced automation. SubGuard targets users who want full visibility and control over their subscription spend without surrendering their data to a third-party server.

This document captures formal requirements derived from the product specification, critically reviewed and augmented to address production-grade concerns including error recovery, offline behavior, data integrity, migration, accessibility, and security.

---

## Glossary

- **SubGuard**: The browser extension product described in this document.
- **Extension**: The SubGuard browser extension running under Manifest V3.
- **Service Worker**: The Manifest V3 background service worker (`background/service-worker.ts`).
- **Content Script**: The page-injected detector script (`content/detector.ts`).
- **Side Panel**: The primary application UI rendered in the browser side panel.
- **Popup**: The compact 360×280px UI rendered when the extension icon is clicked.
- **Subscription**: A recurring payment record tracked by SubGuard.
- **Service Catalog**: The built-in list of 40 known subscription services with metadata.
- **Pro License**: A validated Lemon Squeezy license key that unlocks Pro-tier features.
- **License Validator**: The component that communicates with the Lemon Squeezy API to validate license keys.
- **Email Scanner**: The Pro feature that reads Gmail receipts via OAuth to detect subscriptions.
- **Cancel Helper**: The guided flow that walks users through cancelling a specific service.
- **Renewal Reminder**: A browser notification sent before a subscription renewal date.
- **SpendStats**: The computed aggregate of monthly/annual spend and subscription counts.
- **BillingCycle**: One of: `monthly`, `yearly`, `weekly`, `quarterly`, `lifetime`.
- **SubscriptionStatus**: One of: `active`, `cancelled`, `paused`, `trial`.
- **Storage Layer**: The combination of `chrome.storage.local` (settings/license) and IndexedDB via Dexie.js (subscriptions).
- **Dexie**: The IndexedDB wrapper library used for subscription persistence.
- **Schema Version**: An integer that identifies the current IndexedDB schema revision.
- **Toast**: A transient in-app notification displayed for user feedback.
- **Undo Buffer**: A temporary in-memory store holding a recently deleted subscription for 5 seconds.
- **CSP**: Content Security Policy headers declared in `manifest.json`.
- **OAuth Token**: A short-lived Gmail access token obtained via `chrome.identity`; never persisted.
- **Plausible/Fathom**: Privacy-respecting analytics providers used for opt-in telemetry.
- **Lemon Squeezy**: The payment and license management platform used for Pro purchases.
- **webextension-polyfill**: Mozilla's compatibility shim enabling cross-browser WebExtension API usage.

---

## Requirements

### Requirement 1: Subscription CRUD Management

**User Story:** As a user, I want to manually add, view, edit, and delete subscriptions, so that I can maintain an accurate record of all my recurring payments.

#### Acceptance Criteria

1. THE Extension SHALL provide a form allowing users to create a new subscription with the following required fields: service name, cost, currency, billing cycle, and renewal date.
2. THE Extension SHALL provide optional fields on the subscription form: custom name, category, website URL, notes, cancel URL, and status.
3. WHEN a user submits the subscription form with all required fields valid, THE Extension SHALL persist the subscription to IndexedDB and display it in the dashboard within 300ms.
4. WHEN a user submits the subscription form with one or more required fields missing or invalid, THE Extension SHALL display inline validation errors identifying each invalid field and SHALL NOT persist the record.
5. WHEN a user edits an existing subscription and saves, THE Extension SHALL update the record in IndexedDB and reflect the change in the UI within 300ms.
6. WHEN a user deletes a subscription, THE Extension SHALL remove it from IndexedDB, display a 5-second undo toast, and restore the subscription if the user activates the undo action within that window.
7. WHEN the undo window expires without activation, THE Extension SHALL permanently discard the deleted subscription from the undo buffer.
8. THE Extension SHALL prevent duplicate subscriptions by detecting when a new entry shares the same service name and renewal date as an existing active subscription, and SHALL display a duplicate warning to the user.
9. WHEN a user confirms adding a duplicate subscription, THE Extension SHALL persist it without further obstruction.
10. THE Extension SHALL support all defined currency values: USD, EUR, GBP, PKR, INR, CAD, AUD.
11. THE Extension SHALL support all defined billing cycles: monthly, yearly, weekly, quarterly, lifetime.
12. THE Extension SHALL support all defined subscription statuses: active, cancelled, paused, trial.

### Requirement 2: Dashboard and Spend Analytics

**User Story:** As a user, I want a dashboard that shows my total subscription spend and upcoming renewals, so that I can understand my financial exposure at a glance.

#### Acceptance Criteria

1. THE Extension SHALL compute and display a monthly total spend figure aggregated across all active subscriptions, normalized to the user's selected display currency.
2. THE Extension SHALL compute and display an annual projection figure based on active subscription billing cycles.
3. THE Extension SHALL display the count of active subscriptions and the count of cancelled subscriptions.
4. THE Extension SHALL display upcoming renewals within a configurable look-ahead window (default: 7 days).
5. WHEN a subscription uses a non-display currency, THE Extension SHALL convert its cost to the display currency using stored exchange rates and SHALL indicate the conversion is approximate.
6. THE Extension SHALL provide filter tabs allowing users to view subscriptions by category: All, Streaming, SaaS, Fitness, Food, AI, Cloud, Cancelled.
7. THE Extension SHALL provide sort options: by renewal date (ascending), by cost (descending), and by name (alphabetical).
8. WHEN no subscriptions exist, THE Extension SHALL display an empty state with a prompt to add the first subscription.
9. THE Extension SHALL update SpendStats in real time whenever a subscription is added, edited, deleted, or has its status changed.
10. WHEN the display currency is changed in Settings, THE Extension SHALL recompute all displayed spend figures using the new currency without requiring a page reload.

### Requirement 3: Popup Summary View

**User Story:** As a user, I want a compact popup that shows my key spend metrics and upcoming renewals, so that I can get a quick overview without opening the full dashboard.

#### Acceptance Criteria

1. THE Popup SHALL render within 200ms of the user clicking the extension icon.
2. THE Popup SHALL display the total monthly spend figure prominently.
3. THE Popup SHALL display the next three upcoming renewals in compact rows showing service name, renewal date, and cost.
4. THE Popup SHALL provide a button to open the Side Panel dashboard.
5. THE Popup SHALL provide a quick-action button to open the Add Subscription form.
6. WHEN a Pro license is active, THE Popup SHALL display a Pro badge.
7. WHEN a duplicate subscription is detected, THE Popup SHALL display a duplicate detection notice.
8. IF IndexedDB is unavailable when the Popup opens, THEN THE Popup SHALL display a graceful error message and SHALL NOT crash.

### Requirement 4: Calendar View

**User Story:** As a user, I want a calendar view of my renewal dates, so that I can plan my finances around upcoming charges.

#### Acceptance Criteria

1. THE Extension SHALL render a monthly calendar view showing renewal dots on dates that have one or more renewals.
2. WHEN a user selects a date on the calendar, THE Extension SHALL display a panel listing all subscriptions renewing on that date with their cost and service name.
3. THE Extension SHALL allow navigation between calendar months.
4. WHEN a subscription's renewal date changes, THE Extension SHALL update the calendar view to reflect the new date without requiring a full reload.

### Requirement 5: Renewal Reminder Notifications

**User Story:** As a user, I want to receive browser notifications before my subscriptions renew, so that I am not surprised by unexpected charges.

#### Acceptance Criteria

1. WHEN the Extension is installed or updated, THE Service Worker SHALL register `chrome.alarms` for all active subscriptions with renewal dates in the future.
2. WHEN a renewal alarm fires, THE Service Worker SHALL send a browser notification displaying the service name, renewal amount, and days until renewal.
3. THE Extension SHALL allow users to configure the reminder lead time (days before renewal) in Settings, with a default of 3 days.
4. WHEN a subscription is added or its renewal date is updated, THE Service Worker SHALL cancel any existing alarm for that subscription and register a new alarm at the correct time.
5. WHEN a subscription is deleted or cancelled, THE Service Worker SHALL cancel its associated alarm.
6. WHEN the user has not granted notification permission, THE Extension SHALL prompt the user to grant permission before scheduling notifications and SHALL NOT silently fail.
7. IF the user denies notification permission, THEN THE Extension SHALL disable the notifications toggle in Settings and display an explanatory message.
8. WHEN a notification is clicked, THE Extension SHALL open the Side Panel and navigate to the relevant subscription.
9. THE Service Worker SHALL handle the case where an alarm fires but the associated subscription no longer exists in storage, by discarding the alarm without error.

### Requirement 6: Automatic Subscription Detection (Content Script)

**User Story:** As a user, I want the extension to automatically detect subscriptions while I browse, so that I don't have to manually enter every service.

#### Acceptance Criteria

1. WHEN the Content Script runs on a page belonging to a known service domain, THE Content Script SHALL attempt to extract subscription amount, renewal date, and billing cycle from the page DOM.
2. THE Content Script SHALL only run detection on domains present in the Service Catalog, to minimize noise and performance impact on unrelated pages.
3. WHEN a subscription is successfully detected, THE Content Script SHALL send the detected data to the Service Worker via `chrome.runtime.sendMessage`.
4. WHEN the Service Worker receives detected subscription data, THE Service Worker SHALL check for an existing matching subscription before prompting the user to add it.
5. WHEN a detected subscription does not already exist, THE Extension SHALL display a non-intrusive prompt allowing the user to confirm or dismiss the addition.
6. WHEN a user dismisses a detection prompt for a specific service, THE Extension SHALL not re-prompt for that service on subsequent page visits during the same browser session.
7. IF the Content Script encounters a DOM parsing error, THEN THE Content Script SHALL log the error and exit gracefully without affecting page functionality.
8. WHILE auto-detection is disabled in Settings, THE Content Script SHALL not send detection messages to the Service Worker.
9. THE Extension SHALL record `detectedFrom` on any subscription created via auto-detection, storing the source domain.

### Requirement 7: Email Scanning — Pro Feature

**User Story:** As a Pro user, I want the extension to scan my Gmail inbox for subscription receipts, so that I can automatically discover subscriptions I may have forgotten.

#### Acceptance Criteria

1. WHERE a Pro license is active, THE Extension SHALL provide an option in Settings to enable Gmail email scanning.
2. WHEN email scanning is enabled, THE Extension SHALL initiate a Gmail OAuth flow via `chrome.identity` to obtain an access token.
3. WHEN the OAuth flow succeeds, THE Extension SHALL search the Gmail inbox for emails matching receipt and invoice patterns.
4. WHEN a receipt email is parsed and a subscription is identified, THE Extension SHALL present the detected subscription to the user for confirmation before adding it.
5. THE Extension SHALL NOT persist OAuth tokens to any storage mechanism; tokens SHALL be used in-memory only and discarded after the scan completes.
6. IF the OAuth flow fails or is denied by the user, THEN THE Extension SHALL display an error message and SHALL NOT retry automatically.
7. WHEN an email scan is in progress, THE Extension SHALL display a loading indicator and SHALL allow the user to cancel the scan.
8. THE Extension SHALL rate-limit email scan requests to a maximum of one full scan per 24-hour period per user session to avoid Gmail API quota exhaustion.
9. WHEN the Gmail API returns a rate-limit error, THE Extension SHALL display a user-friendly message and SHALL schedule a retry no sooner than 1 hour later.
10. WHERE email scanning is disabled or a Pro license is not active, THE Extension SHALL display the email scan option as locked with an upgrade prompt.


### Requirement 8: Cancel Helper

**User Story:** As a user, I want step-by-step cancellation guidance for each service, so that I can cancel subscriptions without hunting for the right page.

#### Acceptance Criteria

1. THE Extension SHALL provide a Cancel Helper for each of the 40 services in the Service Catalog, containing step-by-step cancellation instructions.
2. THE Cancel Helper SHALL display a "Open Cancel Page" button that navigates to the service's known cancellation URL in a new tab.
3. THE Cancel Helper SHALL display the subscription's next renewal date and cost as a warning to motivate timely action.
4. WHERE a Pro license is active, THE Cancel Helper SHALL offer an auto-highlight toggle that visually highlights the cancellation button on the target page via the Content Script.
5. WHEN a user completes the cancellation flow and returns to the extension, THE Extension SHALL prompt the user to mark the subscription as cancelled.
6. WHEN a subscription is marked as cancelled via the Cancel Helper, THE Extension SHALL update its status to `cancelled` and cancel its renewal alarm.
7. THE Extension SHALL validate that all 40 cancel URLs are reachable and SHALL flag any that return HTTP 4xx/5xx during the build process.

### Requirement 9: License Management and Pro Feature Gating

**User Story:** As a user, I want to purchase and activate a Pro license, so that I can unlock advanced features without creating a cloud account.

#### Acceptance Criteria

1. THE Extension SHALL provide a license key input field in Settings where users can enter a Lemon Squeezy license key.
2. WHEN a user submits a license key, THE Extension SHALL send a validation request to the Lemon Squeezy API endpoint `https://api.lemonsqueezy.com/v1/licenses/validate`.
3. WHEN the license validation response indicates a valid license, THE Extension SHALL store the license metadata (key, type, validatedAt, expiresAt, email, isValid) in `chrome.storage.local` and activate Pro features immediately.
4. WHEN the license validation response indicates an invalid or expired license, THE Extension SHALL display a clear error message and SHALL NOT activate Pro features.
5. THE Extension SHALL re-validate the stored license key at most once every 24 hours to confirm it has not been revoked, without requiring user action.
6. IF the Lemon Squeezy API is unreachable during validation, THEN THE Extension SHALL retry up to 3 times with exponential backoff before displaying a connectivity error to the user.
7. IF the Lemon Squeezy API is unreachable during the periodic re-validation check, THEN THE Extension SHALL preserve the existing Pro status for up to 7 days before downgrading to free tier.
8. THE Extension SHALL rate-limit license validation requests to a maximum of 5 attempts per hour to prevent abuse.
9. WHEN a license key is removed or deactivated, THE Extension SHALL immediately revoke Pro feature access and clear the stored license metadata.
10. THE Extension SHALL gate the following features behind a valid Pro license: email scanning, Cancel Helper auto-highlight, AI subscription recommendations, smart categorization, PDF export, and full auto-detection.
11. WHEN a free-tier user attempts to access a Pro-gated feature, THE Extension SHALL display an upgrade prompt with pricing information and a link to the Lemon Squeezy checkout.
12. THE Extension SHALL provide a monthly subscription option ($4.99/month) and a lifetime option ($19 one-time) via Lemon Squeezy checkout links.

### Requirement 10: Data Export and Import

**User Story:** As a user, I want to export and import my subscription data, so that I can back up my records and migrate between devices.

#### Acceptance Criteria

1. THE Extension SHALL provide a CSV export function that generates a file containing all subscription records with all fields.
2. WHEN a user triggers CSV export, THE Extension SHALL download the file to the user's default downloads folder with a timestamped filename.
3. WHERE a Pro license is active, THE Extension SHALL provide a PDF export function that generates a formatted report of all subscriptions and spend statistics.
4. THE Extension SHALL provide a CSV import function that reads a file and creates subscription records from valid rows.
5. WHEN importing a CSV file, THE Extension SHALL validate each row against the subscription schema and SHALL skip invalid rows, reporting the count of skipped rows to the user.
6. WHEN importing a CSV file, THE Extension SHALL detect and skip rows that would create duplicate subscriptions, notifying the user of the count of skipped duplicates.
7. WHEN a CSV import completes, THE Extension SHALL display a summary showing the number of records imported, skipped, and any errors encountered.
8. THE Extension SHALL document the expected CSV column format in the Settings UI so users can prepare import files manually.

### Requirement 11: Settings and Personalization

**User Story:** As a user, I want to configure the extension's behavior and appearance, so that it fits my preferences and workflow.

#### Acceptance Criteria

1. THE Extension SHALL provide a theme toggle supporting light mode and dark mode.
2. THE Extension SHALL provide a display currency selector supporting: USD, EUR, GBP, PKR, INR, CAD, AUD.
3. THE Extension SHALL provide a renewal reminder lead-time selector (days before renewal), with a minimum of 1 day and a maximum of 30 days.
4. THE Extension SHALL provide a toggle to enable or disable renewal notifications globally.
5. THE Extension SHALL provide a toggle to enable or disable automatic subscription detection.
6. THE Extension SHALL persist all settings to `chrome.storage.local` so they survive browser restarts.
7. WHEN settings are changed, THE Extension SHALL apply the changes immediately without requiring a restart.
8. THE Extension SHALL provide a "Danger Zone" section in Settings containing a "Delete All Data" action.
9. WHEN a user activates "Delete All Data", THE Extension SHALL display a confirmation dialog requiring explicit confirmation before proceeding.
10. WHEN "Delete All Data" is confirmed, THE Extension SHALL clear all IndexedDB subscription records, all `chrome.storage.local` data, and cancel all registered alarms.
11. THE Extension SHALL provide an opt-in analytics toggle; analytics SHALL be disabled by default and SHALL only be enabled upon explicit user action.

### Requirement 12: Onboarding Flow

**User Story:** As a new user, I want a guided onboarding experience, so that I can understand the extension's value and add my first subscription quickly.

#### Acceptance Criteria

1. WHEN the Extension is installed for the first time, THE Extension SHALL open the onboarding page automatically.
2. THE Onboarding flow SHALL consist of exactly three steps: Welcome, optional Gmail Connect (Pro), and Quick Add first subscription.
3. WHEN a user completes or skips the onboarding flow, THE Extension SHALL set `onboardingComplete: true` in settings and SHALL NOT show the onboarding page again on subsequent installs or updates.
4. THE Onboarding flow SHALL allow users to skip any optional step without blocking progression.
5. WHEN a user completes the Quick Add step during onboarding, THE Extension SHALL persist the subscription and navigate to the dashboard.

### Requirement 13: Keyboard Shortcuts and Search

**User Story:** As a power user, I want keyboard shortcuts and a search interface, so that I can navigate and manage subscriptions efficiently.

#### Acceptance Criteria

1. THE Extension SHALL support a global search shortcut (Cmd/Ctrl+K) that opens a search overlay within the Side Panel.
2. WHEN the search overlay is open, THE Extension SHALL filter subscriptions in real time as the user types, matching against service name, custom name, and notes.
3. THE Extension SHALL support a shortcut (N) to open the Add Subscription form when the Side Panel is focused.
4. THE Extension SHALL support the Escape key to close any open modal, overlay, or form within the Side Panel.
5. WHEN a keyboard shortcut is triggered, THE Extension SHALL respond within 100ms.


### Requirement 14: AI Subscription Recommendations — Pro Feature

**User Story:** As a Pro user, I want AI-powered recommendations on whether to keep or cancel subscriptions, so that I can make informed decisions about my spending.

#### Acceptance Criteria

1. WHERE a Pro license is active, THE Extension SHALL provide a "Should I keep this?" analysis for each subscription.
2. WHEN a user requests an AI recommendation, THE Extension SHALL analyze the subscription's cost, usage frequency (`lastUsed`), category, and billing cycle to generate a recommendation.
3. THE Extension SHALL generate AI recommendations entirely client-side without transmitting subscription data to any external server.
4. WHEN a recommendation is generated, THE Extension SHALL display a rationale alongside the keep/cancel suggestion.
5. WHERE a Pro license is not active, THE Extension SHALL display the AI recommendation feature as locked with an upgrade prompt.

### Requirement 15: Cross-Browser Compatibility

**User Story:** As a user on any Chromium-based browser or Firefox, I want SubGuard to work correctly, so that I am not locked into a specific browser.

#### Acceptance Criteria

1. THE Extension SHALL function fully on Chrome, Edge, Brave, and Opera using native Manifest V3 APIs.
2. THE Extension SHALL use `webextension-polyfill` to normalize browser API differences across all supported browsers.
3. WHERE the browser does not support the Side Panel API (e.g., Firefox), THE Extension SHALL fall back to rendering the main UI in a popup window of appropriate dimensions.
4. THE Extension SHALL pass a build-time check confirming that no browser-specific APIs are called without the polyfill wrapper.
5. WHEN running on Firefox, THE Extension SHALL use the `browser` namespace via the polyfill and SHALL NOT call `chrome.*` APIs directly.

### Requirement 16: Data Persistence and Storage Integrity

**User Story:** As a user, I want my subscription data to be reliably stored and protected against corruption, so that I never lose my records.

#### Acceptance Criteria

1. THE Extension SHALL store all subscription records in IndexedDB via Dexie.js and SHALL store settings and license data in `chrome.storage.local`.
2. WHEN writing a subscription record to IndexedDB, THE Extension SHALL use a Dexie transaction to ensure atomicity; IF the transaction fails, THEN THE Extension SHALL roll back and display an error to the user.
3. THE Extension SHALL define a Schema Version integer in the Dexie database configuration.
4. WHEN the Extension is updated and the Schema Version has incremented, THE Extension SHALL run the appropriate Dexie migration to upgrade the existing database schema without data loss.
5. WHEN a migration fails, THE Extension SHALL log the error, preserve the pre-migration data, and notify the user that a data migration error occurred.
6. THE Extension SHALL perform a startup integrity check that verifies the IndexedDB schema version matches the expected version and logs a warning if a mismatch is detected.
7. IF `chrome.storage.local` read fails on startup, THEN THE Extension SHALL fall back to default settings values and display a non-blocking warning to the user.
8. THE Extension SHALL not exceed the `chrome.storage.local` quota (10MB); WHEN approaching 80% of quota, THE Extension SHALL warn the user.

### Requirement 17: Offline and Connectivity Behavior

**User Story:** As a user, I want the extension to work fully offline for all local features, so that connectivity issues don't disrupt my subscription management.

#### Acceptance Criteria

1. THE Extension SHALL operate all local features (dashboard, CRUD, calendar, notifications, cancel helper steps) without any network connectivity.
2. WHEN the Extension is offline and a license re-validation is due, THE Extension SHALL defer the re-validation until connectivity is restored and SHALL preserve existing Pro status during the deferral period (up to 7 days per Requirement 9.7).
3. WHEN the Extension is offline and a user attempts email scanning, THE Extension SHALL display a connectivity error and SHALL NOT attempt the OAuth flow.
4. WHEN network connectivity is restored after an offline period, THE Extension SHALL automatically resume any deferred background tasks (license re-validation, email scan retry) without user intervention.
5. THE Extension SHALL detect online/offline state changes via the `navigator.onLine` API and the `online`/`offline` window events.

### Requirement 18: Extension Update Handling

**User Story:** As a user, I want the extension to update gracefully without losing my data or disrupting active sessions, so that updates are transparent.

#### Acceptance Criteria

1. WHEN the Extension is updated to a new version, THE Service Worker SHALL handle the `chrome.runtime.onInstalled` event with `reason === 'update'` and SHALL re-register all renewal alarms for active subscriptions.
2. WHEN the Extension is updated, THE Extension SHALL run any pending database migrations before resuming normal operation.
3. WHEN the Extension is updated, THE Extension SHALL NOT reset user settings or subscription data.
4. WHEN the Extension is updated, THE Extension SHALL NOT re-show the onboarding flow if `onboardingComplete` is `true`.
5. WHEN a new version introduces breaking changes to the storage schema, THE Extension SHALL increment the Schema Version and provide a migration path.

### Requirement 19: Performance Requirements

**User Story:** As a user, I want the extension to be fast and lightweight, so that it does not slow down my browser.

#### Acceptance Criteria

1. THE Popup SHALL render its initial view within 200ms of being opened.
2. THE Side Panel SHALL render its initial view within 500ms of being opened.
3. THE Extension SHALL complete any IndexedDB read operation for the dashboard within 300ms for datasets up to 500 subscription records.
4. THE Extension SHALL keep the total build output under 5MB.
5. THE Content Script SHALL complete its DOM analysis and exit within 100ms on any page where it runs.
6. THE Service Worker SHALL not remain active continuously; it SHALL only wake on alarm events, messages, or install/update events per Manifest V3 constraints.
7. THE Extension SHALL not introduce measurable page load regression (>50ms) on any page where the Content Script runs.

### Requirement 20: Security Requirements

**User Story:** As a user, I want the extension to follow security best practices, so that my financial data and browser activity are protected.

#### Acceptance Criteria

1. THE Extension SHALL declare a Content Security Policy in `manifest.json` that restricts `script-src` and `object-src` to `'self'`.
2. THE Extension SHALL not use `eval()` or `new Function()` anywhere in its codebase.
3. THE Extension SHALL rely on React JSX rendering for all dynamic content to prevent XSS via DOM injection.
4. THE Extension SHALL store the license key only in `chrome.storage.local` and SHALL NOT transmit it to any server other than the Lemon Squeezy validation endpoint.
5. THE Extension SHALL NOT persist OAuth tokens to any storage; tokens SHALL be used in-memory only and discarded immediately after use.
6. THE Extension SHALL request only the minimum required browser permissions in `manifest.json`.
7. WHEN communicating with the Lemon Squeezy API, THE Extension SHALL use HTTPS exclusively.
8. THE Extension SHALL sanitize all user-supplied text inputs before rendering them in the UI to prevent stored XSS.
9. THE Extension SHALL not log sensitive data (license keys, OAuth tokens, email content) to the browser console.
10. THE Extension SHALL declare `host_permissions` only for the specific domains required by the Service Catalog and the Lemon Squeezy API.


### Requirement 21: Privacy Requirements

**User Story:** As a user, I want assurance that my subscription data never leaves my device without my consent, so that I can trust the extension with sensitive financial information.

#### Acceptance Criteria

1. THE Extension SHALL store all subscription data exclusively in `chrome.storage.local` and IndexedDB on the user's local device.
2. THE Extension SHALL NOT transmit subscription data, browsing history, or email content to any external server.
3. THE Extension SHALL only contact external servers for: (a) Lemon Squeezy license validation, and (b) Gmail API during an active, user-initiated email scan.
4. WHEN opt-in analytics are enabled, THE Extension SHALL transmit only anonymized, non-personally-identifiable event data to the configured analytics provider (Plausible or Fathom).
5. THE Extension SHALL display a clear privacy statement in the Upgrade and Settings pages explaining what data is and is not transmitted.
6. THE Extension SHALL NOT include any third-party tracking scripts or advertising SDKs.

### Requirement 22: Accessibility Requirements

**User Story:** As a user with accessibility needs, I want the extension UI to be navigable and usable with assistive technologies, so that I am not excluded from managing my subscriptions.

#### Acceptance Criteria

1. THE Extension SHALL ensure all interactive elements (buttons, inputs, links) have accessible labels via `aria-label` or associated `<label>` elements.
2. THE Extension SHALL support full keyboard navigation through all UI components in the Side Panel and Popup without requiring a mouse.
3. THE Extension SHALL maintain a logical focus order that follows the visual layout of each page.
4. THE Extension SHALL provide visible focus indicators on all interactive elements that meet WCAG 2.1 AA contrast requirements.
5. THE Extension SHALL ensure all text content meets a minimum contrast ratio of 4.5:1 against its background in both light and dark themes.
6. THE Extension SHALL use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<section>`, `<h1>`–`<h6>`) throughout the UI.
7. THE Extension SHALL announce dynamic content changes (toast notifications, search results, form validation errors) via ARIA live regions.

### Requirement 23: Trial Period Tracking

**User Story:** As a user, I want to track subscriptions that are in a free trial period, so that I know when I will be charged for the first time.

#### Acceptance Criteria

1. THE Extension SHALL support `trial` as a valid `SubscriptionStatus` value.
2. WHEN a subscription has status `trial`, THE Extension SHALL display a distinct visual indicator (e.g., badge or label) on the subscription card.
3. WHEN a subscription has status `trial` and its renewal date is within the configured reminder window, THE Extension SHALL send a renewal reminder notification indicating it is a trial conversion, not a standard renewal.
4. THE Extension SHALL include trial subscriptions in the upcoming renewals list with a clear trial indicator.
5. WHEN a trial subscription's renewal date passes without a status change, THE Extension SHALL display a prompt asking the user whether the trial has converted to a paid subscription or been cancelled.

### Requirement 24: Subscription Pause and Resume

**User Story:** As a user, I want to pause and resume subscriptions, so that I can track services I have temporarily suspended without deleting them.

#### Acceptance Criteria

1. THE Extension SHALL support `paused` as a valid `SubscriptionStatus` value.
2. WHEN a subscription is set to `paused`, THE Extension SHALL cancel its renewal alarm and exclude it from spend totals.
3. WHEN a subscription is set to `paused`, THE Extension SHALL display it in the dashboard with a distinct paused indicator and SHALL NOT include it in the active subscription count.
4. WHEN a paused subscription is resumed (status changed back to `active`), THE Extension SHALL re-register its renewal alarm and include it in spend totals.
5. THE Extension SHALL allow users to set an optional resume date on a paused subscription; WHEN the resume date arrives, THE Extension SHALL notify the user and prompt them to confirm resumption.

### Requirement 25: Multi-Currency Display and Conversion

**User Story:** As a user with subscriptions in multiple currencies, I want to see all my costs in a single display currency, so that I can understand my true total spend.

#### Acceptance Criteria

1. THE Extension SHALL store each subscription's cost in its original currency as entered by the user.
2. THE Extension SHALL maintain a set of static exchange rates (updated at build time) for all supported currencies relative to USD.
3. WHEN computing SpendStats, THE Extension SHALL convert all subscription costs to the user's selected display currency using the stored exchange rates.
4. THE Extension SHALL display a disclaimer on the dashboard indicating that multi-currency totals are approximate and based on static exchange rates.
5. THE Extension SHALL display each subscription's original currency and cost on its card, alongside the converted display-currency equivalent.
6. WHEN the user changes the display currency, THE Extension SHALL recompute all converted figures immediately.

### Requirement 26: Service Catalog and Logo Management

**User Story:** As a user, I want recognizable service logos and accurate metadata for known services, so that my subscription list is visually clear and easy to scan.

#### Acceptance Criteria

1. THE Extension SHALL include a Service Catalog of at least 40 services with: name, domain(s), default category, default cancel URL, and logo key.
2. THE Extension SHALL bundle PNG logos (64×64px) for all 40 catalog services in the `public/service-logos/` directory.
3. WHEN a subscription's `logoKey` does not match any bundled logo, THE Extension SHALL display a colored avatar using the first letter of the service name as a fallback.
4. THE Extension SHALL provide an autocomplete input on the Add/Edit form that suggests matching catalog services as the user types the service name.
5. WHEN a catalog service is selected via autocomplete, THE Extension SHALL pre-populate the category, website, and cancel URL fields with the catalog defaults, which the user may override.
6. THE Extension SHALL allow users to add subscriptions for services not in the catalog by entering a custom service name.

### Requirement 27: Notification Permission Lifecycle

**User Story:** As a user, I want the extension to handle notification permissions gracefully across all permission states, so that I always understand why notifications are or are not working.

#### Acceptance Criteria

1. WHEN the Extension is first installed, THE Extension SHALL NOT request notification permission automatically; it SHALL wait until the user enables notifications in Settings or completes onboarding.
2. WHEN a user enables notifications in Settings, THE Extension SHALL request `chrome.notifications` permission if not already granted.
3. IF the user denies notification permission, THEN THE Extension SHALL set `notificationsEnabled: false` in settings, disable the notifications toggle, and display a message explaining how to re-enable permissions in browser settings.
4. WHEN notification permission is revoked externally (e.g., via browser settings), THE Extension SHALL detect the revocation on next startup and update `notificationsEnabled` accordingly.
5. THE Extension SHALL not schedule any alarms for notification delivery when `notificationsEnabled` is `false`.

### Requirement 28: Error Recovery and Resilience

**User Story:** As a user, I want the extension to recover gracefully from errors, so that a single failure does not corrupt my data or break the UI.

#### Acceptance Criteria

1. WHEN any unhandled JavaScript error occurs in the Side Panel or Popup, THE Extension SHALL display a user-friendly error boundary message and SHALL NOT show a blank screen.
2. WHEN an IndexedDB operation fails, THE Extension SHALL display a toast error message with a retry option and SHALL log the error details for debugging.
3. WHEN the Service Worker crashes or is terminated by the browser (Manifest V3 lifecycle), THE Extension SHALL re-initialize correctly on the next wake event without data loss.
4. WHEN a network request (license validation, Gmail API) fails with a non-retryable error (4xx), THE Extension SHALL display a specific error message and SHALL NOT retry automatically.
5. WHEN a network request fails with a retryable error (5xx, network timeout), THE Extension SHALL retry up to 3 times with exponential backoff before surfacing the error to the user.
6. THE Extension SHALL implement React error boundaries around all major UI sections (dashboard, calendar, settings, add/edit form) to contain rendering failures.
7. IF the Content Script fails to inject on a page, THEN THE Service Worker SHALL log the failure and SHALL NOT affect the extension's other functionality.


### Requirement 29: Build and Quality Gates

**User Story:** As a developer, I want automated quality gates in the build pipeline, so that regressions and type errors are caught before release.

#### Acceptance Criteria

1. THE Extension build process SHALL run TypeScript type-checking (`tsc --noEmit`) and SHALL fail the build if any type errors are present.
2. THE Extension build process SHALL verify that the total output bundle size does not exceed 5MB and SHALL fail the build if this limit is exceeded.
3. THE Extension build process SHALL validate that all 40 cancel URLs in the Service Catalog return non-4xx HTTP responses.
4. THE Extension build process SHALL verify that all 40 service logo files exist in `public/service-logos/` at the expected paths.
5. THE Extension build process SHALL lint all TypeScript and TSX source files and SHALL fail on any lint errors.
6. THE Extension SHALL include a `npm run type-check` script that developers can run independently of the full build.

### Requirement 30: Analytics and Telemetry (Opt-In)

**User Story:** As a product owner, I want opt-in usage analytics, so that I can understand how users interact with SubGuard without violating their privacy.

#### Acceptance Criteria

1. THE Extension SHALL integrate with a privacy-respecting analytics provider (Plausible or Fathom) for opt-in telemetry.
2. THE Extension SHALL NOT collect any analytics data until the user explicitly opts in via the Settings toggle.
3. WHEN analytics are enabled, THE Extension SHALL track anonymized events such as: subscription added, subscription deleted, Pro upgrade initiated, email scan completed.
4. THE Extension SHALL NOT include personally identifiable information, subscription names, costs, or email addresses in any analytics event.
5. WHEN analytics are disabled, THE Extension SHALL not make any network requests to the analytics provider.

---

## Non-Functional Requirements Summary

The following cross-cutting non-functional requirements apply to the entire SubGuard extension and are elaborated in the requirements above:

- **Performance**: Popup renders in <200ms (Req 3.1, 19.1); Side Panel in <500ms (Req 19.2); IndexedDB reads in <300ms for ≤500 records (Req 19.3); build output <5MB (Req 19.4); Content Script DOM analysis in <100ms (Req 19.5).
- **Security**: CSP `script-src 'self'` (Req 20.1); no `eval()` (Req 20.2); HTTPS-only external calls (Req 20.7); minimum permissions (Req 20.6); no sensitive data in logs (Req 20.9).
- **Privacy**: All data local-only (Req 21.1–21.2); external calls limited to license validation and user-initiated email scan (Req 21.3); opt-in analytics only (Req 21.4).
- **Accessibility**: ARIA labels (Req 22.1); keyboard navigation (Req 22.2); WCAG 2.1 AA contrast (Req 22.4–22.5); semantic HTML (Req 22.6); live regions (Req 22.7).
- **Reliability**: Error boundaries (Req 28.1, 28.6); atomic DB writes (Req 16.2); Service Worker resilience (Req 28.3); graceful offline behavior (Req 17.1–17.5).
- **Maintainability**: Schema versioning and migrations (Req 16.3–16.6); build quality gates (Req 29.1–29.6); type-check script (Req 29.6).

---

## Identified Gaps and Critical Review Notes

The following gaps were identified during the critical review of the original specification. Each has been addressed by one or more requirements above, but is called out here for visibility:

| Gap | Addressed By |
|-----|-------------|
| No error recovery or React error boundaries specified | Req 28 |
| No offline behavior defined | Req 17 |
| No database schema versioning or migration strategy | Req 16.3–16.6 |
| No rate limiting on license validation requests | Req 9.8 |
| No handling of license API unavailability (grace period) | Req 9.7 |
| No notification permission lifecycle (deny/revoke flows) | Req 27 |
| No extension update handling (alarm re-registration, migration) | Req 18 |
| No data integrity checks on startup | Req 16.6 |
| No multi-currency conversion strategy or disclaimer | Req 25 |
| Trial period tracking behavior not specified | Req 23 |
| Subscription pause/resume behavior not specified | Req 24 |
| No CSV import validation or error reporting | Req 10.5–10.7 |
| No duplicate detection logic specified | Req 1.8–1.9 |
| No Gmail API rate limiting or quota handling | Req 7.8–7.9 |
| No build-time URL validation for cancel URLs | Req 29.3 |
| No build-time logo file validation | Req 29.4 |
| No `chrome.storage.local` quota monitoring | Req 16.8 |
| No Service Worker crash/restart resilience | Req 28.3 |
| No accessibility requirements specified | Req 22 |
| No ARIA live regions for dynamic content | Req 22.7 |
| AI recommendations lack client-side constraint | Req 14.3 |
| No analytics data minimization constraints | Req 30.4 |
| No onboarding re-show prevention on updates | Req 18.4 |
| No `chrome.storage.local` read failure fallback | Req 16.7 |
| No Content Script session-level dismiss memory | Req 6.6 |
| No trial-to-paid conversion prompt | Req 23.5 |
| No paused subscription resume date feature | Req 24.5 |
