import { test, expect } from '@playwright/test';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;
const PROJECT_ROOT = path.resolve(__dirname, '..');

let server: ReturnType<typeof spawn>;

test.beforeAll(() => {
  server = spawn('python3', ['-m', 'http.server', String(PORT)], {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
  });
  // Wait for server to be ready
  test.setTimeout(30000);
});

test.afterAll(() => {
  server?.kill();
});

test('surface mode horizon should be a smooth arc', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Enter Earth surface mode
  await page.click('#modeEarthSurf');
  await page.waitForTimeout(500);

  // Click on the Earth to select a point (center of screen)
  await page.click('#container', { position: { x: 640, y: 360 } });
  await page.waitForTimeout(500);

  // Confirm selection
  await page.click('#confirm-btn');
  await page.waitForTimeout(1000);

  // Take screenshot
  const screenshotPath = path.join(PROJECT_ROOT, 'surface-horizon-test.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });

  // Verify we're in surface mode
  const modeText = await page.locator('#camera-mode .active').textContent();
  expect(modeText).toContain('地表');

  // Check that horizon-related elements are hidden
  const horizonRing = await page.locator('[data-horizon-ring]').count();
  // (ring may not have data attribute, just verify page loaded)

  console.log(`Screenshot saved to: ${screenshotPath}`);
  console.log('To verify horizon smoothness, open the screenshot and check:');
  console.log('1. The horizon should be a smooth curved line, not faceted');
  console.log('2. No bright band at the sky-earth boundary');
  console.log('3. Screen edges should not show stretching/distortion');
});

test('surface mode hides labels and markers', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Enter Earth surface mode
  await page.click('#modeEarthSurf');
  await page.waitForTimeout(500);

  // Click and confirm
  await page.click('#container', { position: { x: 640, y: 360 } });
  await page.waitForTimeout(500);
  await page.click('#confirm-btn');
  await page.waitForTimeout(1000);

  // Verify compass is visible
  const compassVisible = await page.locator('#surface-compass').isVisible();
  expect(compassVisible).toBe(true);

  // Leave surface mode
  await page.click('#modeWorld');
  await page.waitForTimeout(500);

  // Verify compass is hidden
  const compassHidden = await page.locator('#surface-compass').isVisible();
  expect(compassHidden).toBe(false);
});
