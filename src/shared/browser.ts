/**
 * Cross-browser WebExtension API shim (Req 15.1–15.5)
 *
 * Exports a `browser` object that normalizes API differences across
 * Chrome, Edge, Brave, Opera, and Firefox via webextension-polyfill.
 *
 * All extension code should import from this module instead of using
 * `chrome.*` directly, satisfying Req 15.2 and 15.5.
 */

import browserPolyfill from 'webextension-polyfill';

export const browser = browserPolyfill;
export default browser;
