/**
 * Test mock for webextension-polyfill.
 * In tests, the polyfill cannot load (it requires a real browser extension context).
 * We proxy to the `chrome` global (provided by jest-chrome or vi.stubGlobal) lazily,
 * so that per-test stubs set via vi.stubGlobal('chrome', ...) are picked up correctly.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler: ProxyHandler<object> = {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chrome = (globalThis as any).chrome;
    if (!chrome) return undefined;
    const value = chrome[prop as string];
    return typeof value === 'function' ? value.bind(chrome) : value;
  },
};

const browser = new Proxy({}, handler);
export default browser;
