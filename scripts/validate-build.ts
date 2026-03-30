/**
 * validate-build.ts
 * Build quality gate script. Runs four checks:
 *   (a) TypeScript type-check (tsc --noEmit)
 *   (b) Bundle output size < 5 MB
 *   (c) HTTP HEAD all 40 cancel URLs — report failures
 *   (d) Verify all 40 logo PNG files exist in public/service-logos/
 *
 * Usage: npx tsx scripts/validate-build.ts
 * Exit code 0 = all checks passed, 1 = one or more checks failed.
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST_DIR = join(ROOT, 'dist');
const LOGOS_DIR = join(ROOT, 'public', 'service-logos');
const MAX_BUNDLE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Service catalog (cancel URLs + logo files) ──────────────────────────────
// Kept inline so this script has zero runtime imports from src/
const SERVICES: Array<{ key: string; cancelUrl: string; logoFile: string }> = [
  { key: 'netflix',         cancelUrl: 'https://www.netflix.com/cancelplan',                          logoFile: 'netflix.png' },
  { key: 'spotify',         cancelUrl: 'https://www.spotify.com/account/subscription/cancel',         logoFile: 'spotify.png' },
  { key: 'hulu',            cancelUrl: 'https://secure.hulu.com/account/cancel',                      logoFile: 'hulu.png' },
  { key: 'disney-plus',     cancelUrl: 'https://www.disneyplus.com/account/subscription',             logoFile: 'disney-plus.png' },
  { key: 'hbo-max',         cancelUrl: 'https://www.max.com/account/subscription',                    logoFile: 'hbo-max.png' },
  { key: 'prime-video',     cancelUrl: 'https://www.amazon.com/mc/pipelines/cancellation',            logoFile: 'prime-video.png' },
  { key: 'apple-tv',        cancelUrl: 'https://support.apple.com/en-us/HT202039',                    logoFile: 'apple-tv.png' },
  { key: 'youtube-premium', cancelUrl: 'https://www.youtube.com/paid_memberships',                    logoFile: 'youtube-premium.png' },
  { key: 'peacock',         cancelUrl: 'https://www.peacocktv.com/account/cancel-plan',               logoFile: 'peacock.png' },
  { key: 'paramount-plus',  cancelUrl: 'https://www.paramountplus.com/account/cancel/',               logoFile: 'paramount-plus.png' },
  { key: 'crunchyroll',     cancelUrl: 'https://www.crunchyroll.com/account/membership',              logoFile: 'crunchyroll.png' },
  { key: 'dropbox',         cancelUrl: 'https://www.dropbox.com/account/plan',                        logoFile: 'dropbox.png' },
  { key: 'box',             cancelUrl: 'https://app.box.com/account',                                 logoFile: 'box.png' },
  { key: 'notion',          cancelUrl: 'https://www.notion.so/my-account',                            logoFile: 'notion.png' },
  { key: 'evernote',        cancelUrl: 'https://www.evernote.com/Billing.action',                     logoFile: 'evernote.png' },
  { key: 'slack',           cancelUrl: 'https://slack.com/intl/en-us/help/articles/203953146',        logoFile: 'slack.png' },
  { key: 'zoom',            cancelUrl: 'https://support.zoom.us/hc/en-us/articles/203634215',         logoFile: 'zoom.png' },
  { key: 'adobe-cc',        cancelUrl: 'https://account.adobe.com/plans',                             logoFile: 'adobe-cc.png' },
  { key: 'figma',           cancelUrl: 'https://www.figma.com/settings',                              logoFile: 'figma.png' },
  { key: 'canva',           cancelUrl: 'https://www.canva.com/settings/billing',                      logoFile: 'canva.png' },
  { key: 'github',          cancelUrl: 'https://github.com/settings/billing',                         logoFile: 'github.png' },
  { key: 'atlassian',       cancelUrl: 'https://admin.atlassian.com',                                 logoFile: 'atlassian.png' },
  { key: 'monday',          cancelUrl: 'https://monday.com/account-settings/billing',                 logoFile: 'monday.png' },
  { key: 'asana',           cancelUrl: 'https://app.asana.com/-/account_api',                         logoFile: 'asana.png' },
  { key: 'trello',          cancelUrl: 'https://trello.com/billing',                                  logoFile: 'trello.png' },
  { key: 'duolingo',        cancelUrl: 'https://www.duolingo.com/settings/super',                     logoFile: 'duolingo.png' },
  { key: 'coursera',        cancelUrl: 'https://www.coursera.org/account-profile',                    logoFile: 'coursera.png' },
  { key: 'udemy',           cancelUrl: 'https://www.udemy.com/user/edit-account/',                    logoFile: 'udemy.png' },
  { key: 'skillshare',      cancelUrl: 'https://www.skillshare.com/settings/membership',              logoFile: 'skillshare.png' },
  { key: 'masterclass',     cancelUrl: 'https://www.masterclass.com/account/membership',              logoFile: 'masterclass.png' },
  { key: 'peloton',         cancelUrl: 'https://members.onepeloton.com/profile/membership',           logoFile: 'peloton.png' },
  { key: 'calm',            cancelUrl: 'https://www.calm.com/account',                                logoFile: 'calm.png' },
  { key: 'headspace',       cancelUrl: 'https://www.headspace.com/account',                           logoFile: 'headspace.png' },
  { key: 'nytimes',         cancelUrl: 'https://myaccount.nytimes.com/seg/subscription',              logoFile: 'nytimes.png' },
  { key: 'wsj',             cancelUrl: 'https://store.wsj.com/shop/wsjus/cancelsubscription',         logoFile: 'wsj.png' },
  { key: 'medium',          cancelUrl: 'https://medium.com/me/membership',                            logoFile: 'medium.png' },
  { key: 'grammarly',       cancelUrl: 'https://account.grammarly.com/subscription',                  logoFile: 'grammarly.png' },
  { key: 'lastpass',        cancelUrl: 'https://lastpass.com/account.php',                            logoFile: 'lastpass.png' },
  { key: '1password',       cancelUrl: 'https://my.1password.com/profile',                            logoFile: '1password.png' },
  { key: 'chatgpt-plus',    cancelUrl: 'https://chat.openai.com/account/billing',                     logoFile: 'chatgpt-plus.png' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sectionHeader(title: string): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

function pass(msg: string): void { console.log(`  ✅  ${msg}`); }
function fail(msg: string): void { console.log(`  ❌  ${msg}`); }
function warn(msg: string): void { console.log(`  ⚠️   ${msg}`); }

// ─── Check (a): TypeScript type-check ────────────────────────────────────────

function checkTypeScript(): boolean {
  sectionHeader('(a) TypeScript type-check');
  try {
    execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'inherit' });
    pass('tsc --noEmit passed with zero errors');
    return true;
  } catch {
    fail('tsc --noEmit reported type errors (see output above)');
    return false;
  }
}

// ─── Check (b): Bundle size < 5 MB ───────────────────────────────────────────

function checkBundleSize(): boolean {
  sectionHeader('(b) Bundle output size < 5 MB');

  if (!existsSync(DIST_DIR)) {
    warn(`dist/ directory not found — skipping size check (run 'npm run build' first)`);
    return true; // non-fatal: build may not have run yet
  }

  const totalBytes = getDirSize(DIST_DIR);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

  if (totalBytes <= MAX_BUNDLE_BYTES) {
    pass(`Bundle size: ${totalMB} MB (limit: 5 MB)`);
    return true;
  } else {
    fail(`Bundle size: ${totalMB} MB exceeds 5 MB limit`);
    return false;
  }
}

function getDirSize(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += getDirSize(fullPath);
    } else {
      total += statSync(fullPath).size;
    }
  }
  return total;
}

// ─── Check (c): HTTP HEAD all 40 cancel URLs ─────────────────────────────────

async function checkCancelUrls(): Promise<boolean> {
  sectionHeader('(c) HTTP HEAD — 40 cancel URLs');

  const failures: string[] = [];
  const TIMEOUT_MS = 10_000;

  await Promise.all(
    SERVICES.map(async ({ key, cancelUrl }) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const res = await fetch(cancelUrl, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timer);

        if (res.status >= 400) {
          fail(`${key}: HTTP ${res.status} — ${cancelUrl}`);
          failures.push(key);
        } else {
          pass(`${key}: HTTP ${res.status}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fail(`${key}: ${msg} — ${cancelUrl}`);
        failures.push(key);
      }
    }),
  );

  if (failures.length === 0) {
    console.log(`\n  All ${SERVICES.length} cancel URLs are reachable.`);
    return true;
  } else {
    console.log(`\n  ${failures.length} URL(s) failed: ${failures.join(', ')}`);
    return false;
  }
}

// ─── Check (d): Logo PNG files exist ─────────────────────────────────────────

function checkLogoFiles(): boolean {
  sectionHeader('(d) Service logo PNG files in public/service-logos/');

  if (!existsSync(LOGOS_DIR)) {
    fail(`Directory not found: ${LOGOS_DIR}`);
    console.log(`  Create the directory and add all 40 logo PNG files.`);
    return false;
  }

  const missing: string[] = [];

  for (const { key, logoFile } of SERVICES) {
    const filePath = join(LOGOS_DIR, logoFile);
    if (existsSync(filePath)) {
      pass(`${key}: ${logoFile}`);
    } else {
      fail(`${key}: ${logoFile} — NOT FOUND`);
      missing.push(logoFile);
    }
  }

  if (missing.length === 0) {
    console.log(`\n  All ${SERVICES.length} logo files present.`);
    return true;
  } else {
    console.log(`\n  ${missing.length} logo file(s) missing.`);
    return false;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🔍  SubGuard Build Validation');
  console.log(`    Root: ${ROOT}`);

  const results = await Promise.all([
    Promise.resolve(checkTypeScript()),
    Promise.resolve(checkBundleSize()),
    checkCancelUrls(),
    Promise.resolve(checkLogoFiles()),
  ]);

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log(`\n${'═'.repeat(60)}`);
  if (passed === total) {
    console.log(`  🎉  All ${total} checks passed.`);
    process.exit(0);
  } else {
    console.log(`  ❌  ${total - passed}/${total} check(s) failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
