/**
 * Playwright script to generate screenshots of all main pages.
 * Usage: npm run screenshots
 *
 * Requires the Next.js dev server to be running (npm run dev).
 */

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000';
const OUT_DIR = path.resolve(process.cwd(), 'docs/screenshots');
const USERNAME = 'a';
const PASSWORD = 'a';

const VIEWPORT = { width: 1280, height: 2400 };

interface PageConfig {
  name: string;
  path: string;
  requiresAuth: boolean;
  /** Optional: wait for this selector before screenshotting */
  waitFor?: string;
  /** Optional: wait extra ms after navigation */
  waitMs?: number;
}

const PAGES: PageConfig[] = [
  { name: 'login', path: '/login', requiresAuth: false },
  { name: 'home', path: '/home', requiresAuth: true, waitMs: 500 },
  { name: 'game', path: '/game', requiresAuth: true, waitMs: 2000 },
  { name: 'factory', path: '/factory', requiresAuth: true, waitMs: 500 },
  { name: 'research', path: '/research', requiresAuth: true, waitMs: 500 },
  { name: 'ship', path: '/ship', requiresAuth: true, waitMs: 500 },
  { name: 'profile', path: '/profile', requiresAuth: true, waitMs: 500 },
];

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  // ── Login ────────────────────────────────────────────────────────────────
  console.log('🔑 Logging in...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'load', timeout: 60_000 });
  await page.fill('input[name="username"]', USERNAME);
  await page.fill('input[name="password"]', PASSWORD);

  // Screenshot the login page before submitting
  const loginOutPath = path.join(OUT_DIR, 'login.png');
    await page.screenshot({ path: loginOutPath, fullPage: true });
  console.log(`  ✅ Saved ${loginOutPath}`);

  await page.click('button[type="submit"]');

  // Wait until redirected away from /login
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 });
  console.log('  ✅ Logged in successfully');

  // ── Authenticated pages ──────────────────────────────────────────────────
  for (const cfg of PAGES.filter((p) => p.requiresAuth)) {
    console.log(`📸 Capturing /${cfg.name}...`);
    await page.goto(`${BASE_URL}${cfg.path}`, { waitUntil: 'load', timeout: 60_000 });

    if (cfg.waitFor) {
      await page.waitForSelector(cfg.waitFor, { timeout: 8_000 });
    }
    if (cfg.waitMs) {
      await page.waitForTimeout(cfg.waitMs);
    }

    const outPath = path.join(OUT_DIR, `${cfg.name}.png`);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`  ✅ Saved ${outPath}`);
  }

  await browser.close();
  console.log('\n🎉 All screenshots saved to docs/screenshots/');
}

run().catch((err) => {
  console.error('❌ Screenshot generation failed:', err);
  process.exit(1);
});
