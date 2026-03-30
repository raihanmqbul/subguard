import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import * as fc from 'fast-check';
// jest-chrome uses CJS; import via require for synchronous setup
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chrome } = require('jest-chrome') as { chrome: typeof globalThis.chrome };

// Make chrome available globally (required by webextension-polyfill)
Object.assign(globalThis, { chrome });

// Configure fast-check global settings
fc.configureGlobal({ numRuns: 100 });
