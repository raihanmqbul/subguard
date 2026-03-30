# Implementation Plan: SubGuard Browser Extension

## Overview

Build SubGuard incrementally, starting with the shared foundation (types, storage, DB), then the background layer, then each UI context, then Pro features, and finally polish and quality gates. Each phase produces working, testable code before the next begins.

## Tasks

- [x] 1. Scaffold project foundation and shared types
  - Initialize Vite + React 18 + TypeScript project with `vite-plugin-web-extension`
  - Create `manifest.json` with MV3 structure, CSP (`script-src 'self'; object-src 'self'`), permissions, and `host_permissions` for the 40 service domains + Lemon Squeezy API
  - Create `src/shared/types.ts` with all interfaces: `Subscription`, `UserSettings`, `LicenseInfo`, `SpendStats`, `UpcomingRenewal`, `ServiceCatalogEntry`, and all union types (`BillingCycle`, `SubscriptionStatus`, `Category`, `Currency`)
  - Create `src/shared/constants.ts` with `SERVICE_CATALOG` (40 entries), `EXCHANGE_RATES_USD_BASE`, `DEFAULT_SETTINGS`, and `SCHEMA_VERSION`
  - Configure Tailwind CSS, `postcss.config.js`, `tailwind.config.ts`, and `src/styles/globals.css`
  - Set up Vitest with jsdom environment and `src/test/setup.ts` (chrome API mocks via `jest-chrome`, `fake-indexeddb`)
  - _Requirements: 1.10, 1.11, 1.12, 20.1, 20.6, 20.10, 26.1_

- [-] 2. Implement storage and database layers
  - [x] 2.1 Implement `src/shared/storage.ts` — typed `chrome.storage.local` wrappers with fallback to `DEFAULT_SETTINGS` on read failure; include `getSettings`, `setSettings`, `getLicense`, `setLicense`
    - _Requirements: 11.6, 16.7_
  - [ ]* 2.2 Write property test for settings persistence round-trip
    - **Property 12: Settings persistence round-trip**
    - **Validates: Requirements 11.6**
  - [x] 2.3 Implement `src/shared/db.ts` — `SubGuardDB` extends `Dexie` with version 1 schema; export `SCHEMA_VERSION` constant; wrap all writes in transactions; catch migration errors and re-throw with context
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  - [ ]* 2.4 Write property test for subscription CRUD round-trip
    - **Property 1: Subscription CRUD round-trip**
    - **Validates: Requirements 1.3, 1.5, 16.2**
  - [x] 2.5 Implement `src/shared/utils.ts` — `computeSpendStats(subscriptions, settings)`, `normalizeToMonthly(cost, cycle)`, `convertCurrency(amount, from, to, rates)`, `isDuplicate(candidate, existing)`, `validateSubscription(input)`
    - _Requirements: 2.1, 2.2, 1.4, 1.8, 25.3_
  - [ ]* 2.6 Write property tests for SpendStats and currency conversion
    - **Property 2: SpendStats monthly total consistency**
    - **Property 3: Paused subscriptions excluded from spend**
    - **Property 7: Currency conversion consistency**
    - **Validates: Requirements 2.1, 24.2, 25.3**
  - [ ]* 2.7 Write property tests for validation and duplicate detection
    - **Property 5: Duplicate detection correctness**
    - **Property 9: Whitespace subscription names rejected**
    - **Validates: Requirements 1.4, 1.8**

- [x] 3. Checkpoint — Ensure all storage and utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement message bus and license service
  - [x] 4.1 Implement `src/shared/messageBus.ts` — typed `Message<T, P>` and `MessageResponse<T>` interfaces; `sendMessage` helper with typed overloads; `onMessage` handler registration utility
    - _Requirements: 6.3, 7.2_
  - [x] 4.2 Implement `src/shared/licenseService.ts` — `validateLicense(key)` with exponential backoff (3 retries: 1s, 2s, 4s); `revalidateStoredLicense()` with 7-day grace period; rate limiter (5 attempts/hour using `chrome.storage.local` counter)
    - _Requirements: 9.2, 9.3, 9.4, 9.6, 9.7, 9.8_
  - [ ]* 4.3 Write property test for license rate-limit enforcement
    - **Property 8: License rate-limit enforcement**
    - **Validates: Requirements 9.8**

- [x] 5. Implement Service Worker
  - [x] 5.1 Implement `src/background/service-worker.ts` — `onInstalled` handler (install: open onboarding, register all alarms; update: re-register alarms, run migrations); `onAlarm` handler (renewal notifications, license re-validation); `onMessage` router; `onNotificationClicked` handler
    - _Requirements: 5.1, 5.2, 5.4, 5.9, 18.1, 18.2, 27.1_
  - [x] 5.2 Implement alarm management functions — `scheduleRenewalAlarm(subscription, reminderDays)`, `cancelAlarm(subscriptionId)`, `reregisterAllAlarms(subscriptions, settings)`; handle missing subscription on alarm fire gracefully
    - _Requirements: 5.1, 5.4, 5.5, 5.9_
  - [ ]* 5.3 Write property tests for alarm registration and cleanup
    - **Property 4: Alarm registration invariant**
    - **Property 10: Cancelled/paused subscription alarm cleanup**
    - **Validates: Requirements 5.1, 5.5, 24.2**
  - [x] 5.4 Implement notification permission lifecycle — `checkNotificationPermission()` on startup; update `notificationsEnabled` if permission was revoked externally; request permission when user enables notifications
    - _Requirements: 5.6, 5.7, 27.2, 27.3, 27.4, 27.5_

- [x] 6. Implement Content Script
  - [x] 6.1 Implement `src/content/detector.ts` — domain guard against `SERVICE_CATALOG` domains; regex extraction for amount, date, billing cycle; session-level `Set<string>` for dismissed services; `sendMessage(SUBSCRIPTION_DETECTED, ...)` on match; all DOM access in try/catch; exit within 100ms
    - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.7, 6.8, 6.9, 19.5_
  - [ ]* 6.2 Write property test for content script detection patterns
    - **Property (from Req 6.1): DOM extraction correctness**
    - For any mock DOM string containing known patterns, the extractor should return the correct amount, date, and cycle
    - **Validates: Requirements 6.1**

- [x] 7. Checkpoint — Ensure all background and content script tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 8. Implement Popup UI
  - [x] 8.1 Create `src/popup/Popup.tsx` — monthly spend total, next 3 upcoming renewals (compact rows), "Open Dashboard" button, "Add Subscription" quick-action button, Pro badge (conditional), duplicate detection notice (conditional); wrap in React error boundary
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [x] 8.2 Wire `src/popup/main.tsx` and `src/popup/index.html`; ensure popup renders within 200ms by reading from `chrome.storage.local` first (cached stats) before querying IndexedDB
    - _Requirements: 3.1, 19.1_

- [x] 9. Implement Onboarding flow
  - [x] 9.1 Create `src/onboarding/Onboarding.tsx` — 3-step flow: Welcome (logo animation), optional Gmail Connect (Pro gate), Quick Add first subscription; skip buttons on optional steps; on completion set `onboardingComplete: true`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  - [x] 9.2 Wire `src/onboarding/main.tsx` and `src/onboarding/index.html`; Service Worker opens this page on first install only

- [x] 10. Implement Side Panel — core layout and navigation
  - [x] 10.1 Create `src/sidepanel/App.tsx` with `react-router-dom` v6 routes: `/` (Dashboard), `/calendar`, `/add`, `/edit/:id`, `/cancel/:id`, `/settings`, `/upgrade`; left sidebar with icon-only navigation; global keyboard shortcut listeners (Cmd/Ctrl+K, N, Escape)
    - _Requirements: 13.3, 13.4, 13.5_
  - [x] 10.2 Implement `useToast` hook and `ToastContainer` component — 5-second auto-dismiss, undo action support, ARIA live region announcement
    - _Requirements: 1.6, 22.7_
  - [x] 10.3 Implement search overlay component — triggered by Cmd/Ctrl+K; real-time filter against service name, custom name, notes; keyboard navigation within results; Escape to close
    - _Requirements: 13.1, 13.2, 13.4_
  - [ ]* 10.4 Write property test for search filter correctness
    - **Property 11: Search filter correctness**
    - **Validates: Requirements 13.2**

- [x] 11. Implement Dashboard page
  - [x] 11.1 Create `src/sidepanel/pages/Dashboard.tsx` — stat bar (monthly total, annual projection, active count, cancelled count); filter tabs (All/Streaming/SaaS/Fitness/Food/AI/Cloud/Cancelled); sort options (renewal date, cost, name); subscription cards with hover actions (edit, delete, cancel helper); empty state
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9_
  - [x] 11.2 Implement subscription card component — service logo (with colored-avatar fallback), service name, cost in original currency + converted display currency, renewal date, status badge (trial/paused indicators), category chip; hover actions
    - _Requirements: 23.2, 24.3, 25.5, 26.3_
  - [x] 11.3 Implement multi-currency disclaimer banner — shown when `SpendStats.isApproximate` is true
    - _Requirements: 2.5, 25.4_

- [x] 12. Implement Add/Edit Subscription form
  - [x] 12.1 Create `src/sidepanel/pages/SubscriptionForm.tsx` — service autocomplete (matches catalog, pre-populates category/website/cancelUrl), cost + currency selector, billing cycle picker, renewal date picker, category selector, website, notes, status selector; inline validation errors; duplicate warning dialog
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 1.9, 26.4, 26.5, 26.6_
  - [x] 12.2 Wire form submission to IndexedDB write + alarm scheduling + SpendStats recompute; on success navigate to dashboard and show success toast; on failure show error toast with retry
    - _Requirements: 1.3, 2.9, 5.4, 28.2_

- [x] 13. Implement Calendar page
  - [x] 13.1 Create `src/sidepanel/pages/Calendar.tsx` — month grid with renewal dots; month navigation; right panel showing renewals for selected date (service name, cost, status); update on subscription changes
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 14. Implement Cancel Helper
  - [x] 14.1 Create `src/sidepanel/pages/CancelHelper.tsx` — step-by-step instructions per service from catalog; "Open Cancel Page" button (opens cancelUrl in new tab); renewal date + cost warning; "Mark as Cancelled" button that updates status and cancels alarm
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6_
  - [x] 14.2 Add Pro auto-highlight toggle (gated behind license check); when enabled, send a message to the Content Script on the target tab to highlight the cancel button
    - _Requirements: 8.4_

- [x] 15. Implement Settings page
  - [x] 15.1 Create `src/sidepanel/pages/Settings.tsx` — theme toggle, display currency selector, reminder days input (1–30), notifications toggle (with permission request flow), auto-detection toggle, email scan toggle (Pro gate), license key input + validate button, analytics opt-in toggle
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.7, 11.11, 27.2, 27.3_
  - [x] 15.2 Implement CSV export — serialize all subscriptions to CSV with timestamped filename; trigger browser download
    - _Requirements: 10.1, 10.2_
  - [x] 15.3 Implement CSV import — file picker, row-by-row validation, duplicate skip, summary toast (imported/skipped/errors); document expected column format in UI
    - _Requirements: 10.4, 10.5, 10.6, 10.7, 10.8_
  - [ ]* 15.4 Write property test for CSV export/import round-trip
    - **Property 6: CSV export/import round-trip**
    - **Validates: Requirements 10.1, 10.4**
  - [x] 15.5 Implement Danger Zone — "Delete All Data" button with confirmation dialog; on confirm: clear IndexedDB, clear `chrome.storage.local`, cancel all alarms
    - _Requirements: 11.8, 11.9, 11.10_

- [x] 16. Checkpoint — Ensure all Side Panel tests pass and UI renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Implement Pro features — license gating and Upgrade page
  - [x] 17.1 Create `src/sidepanel/pages/Upgrade.tsx` — feature comparison table (Free vs Pro), pricing ($4.99/month, $19 lifetime), Lemon Squeezy checkout CTA buttons
    - _Requirements: 9.11, 9.12_
  - [x] 17.2 Implement license key validation UI in Settings — input field, validate button, loading state, success/error feedback, Pro badge activation; wire to `licenseService.validateLicense()`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.9_
  - [x] 17.3 Implement Pro feature gates — `useProLicense()` hook that reads license from storage; wrap all Pro-gated UI sections with a `<ProGate>` component that shows upgrade prompt when unlicensed
    - _Requirements: 9.10, 9.11_

- [x] 18. Implement Pro features — email scanner
  - [x] 18.1 Implement `src/shared/emailScanner.ts` — Gmail OAuth via `chrome.identity.getAuthToken`; search inbox for receipt/invoice patterns; parse emails for subscription data; rate-limit to 1 scan per 24 hours; cancel scan support; discard token after use
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  - [x] 18.2 Wire email scan to Service Worker message handler (`START_EMAIL_SCAN`, `CANCEL_EMAIL_SCAN`); handle Gmail 429 with user-friendly message and 1-hour retry scheduling
    - _Requirements: 7.7, 7.9_

- [x] 19. Implement AI subscription recommendations — Pro feature
  - [x] 19.1 Implement client-side recommendation engine in `src/shared/aiRecommendations.ts` — analyze cost, `lastUsed`, category, billing cycle; produce keep/cancel recommendation with rationale; no external API calls
    - _Requirements: 14.1, 14.2, 14.3, 14.4_
  - [x] 19.2 Add "Should I keep this?" button to subscription card (Pro gate); display recommendation in a modal with rationale text
    - _Requirements: 14.1, 14.5_

- [x] 20. Implement trial and pause/resume flows
  - [x] 20.1 Add trial status handling — distinct badge on subscription cards; trial-conversion notification text in alarm handler; trial-to-paid conversion prompt when renewal date passes without status change
    - _Requirements: 23.2, 23.3, 23.4, 23.5_
  - [x] 20.2 Add pause/resume UI — pause action on subscription card updates status to `paused`, cancels alarm, excludes from spend; resume action restores `active` status and re-registers alarm; optional resume date field in edit form
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

- [x] 21. Implement offline detection and error recovery
  - [x] 21.1 Add `useOnlineStatus()` hook using `navigator.onLine` and `online`/`offline` events; display offline banner in Side Panel when disconnected; disable email scan and license validation UI when offline
    - _Requirements: 17.1, 17.3, 17.5_
  - [x] 21.2 Implement React error boundaries — `<ErrorBoundary>` component wrapping Dashboard, Calendar, Settings, Add/Edit Form, Cancel Helper; display "Something went wrong" card with reload button on error
    - _Requirements: 28.1, 28.6_
  - [x] 21.3 Add `chrome.storage.local` quota monitoring — check quota usage on startup; display warning toast when usage exceeds 80% of 10MB limit
    - _Requirements: 16.8_

- [x] 22. Implement opt-in analytics
  - [x] 22.1 Implement `src/shared/analytics.ts` — Plausible/Fathom integration; only fires events when `analyticsOptIn: true`; tracks: subscription_added, subscription_deleted, pro_upgrade_initiated, email_scan_completed; no PII in any event payload
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5_

- [x] 23. Checkpoint — Ensure all Pro feature tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 24. Cross-browser compatibility and polish
  - [x] 24.1 Add `webextension-polyfill` — replace all direct `chrome.*` calls with `browser.*` via polyfill; add Firefox Side Panel fallback (render in popup when `sidePanel` API unavailable)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  - [x] 24.2 Implement loading states — skeleton loaders for dashboard and calendar during IndexedDB reads; spinner for license validation and email scan
  - [x] 24.3 Implement accessibility pass — audit all interactive elements for `aria-label`; verify keyboard tab order; add ARIA live regions to toast container and search results; verify color contrast in both themes
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7_
  - [x] 24.4 Add smart categorization (Pro) — auto-assign category based on service name when adding via autocomplete; allow user override
    - _Requirements: 9.10_

- [-] 25. Build quality gates
  - [x] 25.1 Add `scripts/build-icons.ts` — generate all required icon sizes from source SVG
  - [x] 25.2 Add `scripts/validate-build.ts` — (a) run `tsc --noEmit`; (b) check bundle output size < 5MB; (c) HTTP HEAD all 40 cancel URLs and report failures; (d) verify all 40 logo PNG files exist in `public/service-logos/`
    - _Requirements: 29.1, 29.2, 29.3, 29.4_
  - [x] 25.3 Add ESLint configuration with TypeScript rules; add `npm run lint` script; wire lint into build
    - _Requirements: 29.5_
  - [x] 25.4 Add `npm run type-check` script (`tsc --noEmit`) as a standalone command
    - _Requirements: 29.6_

- [x] 26. Final checkpoint — Full test suite and build validation
  - Run `npm run type-check` — zero errors required
  - Run full Vitest suite — all tests pass
  - Run `npm run build` — bundle under 5MB, all quality gates pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each phase boundary
- Property tests use fast-check with minimum 100 iterations per property
- Unit tests focus on specific examples, edge cases, and integration points
- The Service Worker must be stateless — read all state from storage on each wake event
