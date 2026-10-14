import type { CapacitorConfig } from '@capacitor/core';

/* FinanceOS — Capacitor config.
   No build step: the app is vanilla HTML/CSS/JS, so webDir points at the
   repo root. `npx cap sync` copies everything (including vendor/pdf.js and
   vendor/tesseract, which must ship with the app) into the native shell. */
const config: CapacitorConfig = {
  appId: 'com.financeos.app',
  appName: 'FinanceOS',
  webDir: '.',
  backgroundColor: '#0a0d0b',
  ios: {
    // keep web content clear of the notch / home indicator
    contentInset: 'always',
    // stay inside the app; external links (e.g. finnhub.io signup) open in Safari
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
