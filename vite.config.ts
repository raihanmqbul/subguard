import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import webExtension from 'vite-plugin-web-extension';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), webExtension({
    manifest: 'manifest.json',
    additionalInputs: [
      'src/sidepanel/index.html',
      'src/popup/index.html',
      'src/onboarding/index.html',
    ],
  }), cloudflare()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});