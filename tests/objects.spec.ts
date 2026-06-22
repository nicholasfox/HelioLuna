import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import * as path from 'path';

const PORT = 8083;
const BASE_URL = `http://localhost:${PORT}`;
const PROJECT_ROOT = path.resolve(__dirname, '..');

let server;

test.beforeAll(() => {
  server = spawn('python3', ['-m', 'http.server', String(PORT)], {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
  });
  test.setTimeout(60000);
});

test.afterAll(() => {
  server?.kill();
});

async function getDbg(page) {
  return await page.evaluate(() => window.__dbg);
}

test('world mode: body labels visible, sunMesh visible, no sun sprite', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const dbg = await getDbg(page);
  // World mode by default
  expect(dbg.cameraMode).toBe('world');
  expect(dbg.sunMeshVisible).toBe(true);
  expect(dbg.sunSpriteVisible).toBeNull(); // no sprite created yet
  expect(dbg.sunLabelVisible).toBe(true);
  expect(dbg.earthLabelVisible).toBe(true);
  expect(dbg.moonLabelVisible).toBe(true);
  await page.screenshot({ path: 'test-results/world-labels.png', fullPage: false });
});

test('surface mode: sunMesh hidden, sun sprite visible and centered', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Enter surface mode
  await page.click('#btnSpring');
  await page.waitForTimeout(500);
  await page.click('#modeEarthSurf');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__selectSurfacePoint(0, 0));
  await page.waitForTimeout(300);
  await page.click('#confirm-btn');
  await page.waitForTimeout(1000);

  const dbg = await getDbg(page);
  expect(dbg.cameraMode).toBe('earthSurface');

  // sunMesh must be hidden — only the sprite should render
  expect(dbg.sunMeshVisible).toBe(false);

  // Sun sprite must exist and be visible
  expect(dbg.sunSpriteVisible).not.toBeNull();
  expect(dbg.sunSpriteVisible).toBe(true);

  // Sprite must be on screen (centered at the Sun direction)
  expect(dbg.spriteOnScreen).toBe(true);

  // Body labels hidden in surface mode
  expect(dbg.sunLabelVisible).toBe(false);
  expect(dbg.earthLabelVisible).toBe(false);
  expect(dbg.moonLabelVisible).toBe(false);
});

test('drag disables autoTrack, sprite no longer centered', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.click('#btnSpring');
  await page.waitForTimeout(500);
  await page.click('#modeEarthSurf');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__selectSurfacePoint(0, 0));
  await page.waitForTimeout(300);
  await page.click('#confirm-btn');
  await page.waitForTimeout(1000);

  // autoTrack is on: sprite should be centered
  let dbg = await getDbg(page);
  expect(dbg.surfaceAutoTrack).toBe(true);
  expect(dbg.spriteOnScreen).toBe(true);
  const cx = dbg.spriteScreenX, cy = dbg.spriteScreenY;
  expect(Math.abs(cx)).toBeLessThan(0.15);
  expect(Math.abs(cy)).toBeLessThan(0.15);

  // Simulate a drag (200px horizontal) to disable autoTrack
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 200, sy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  dbg = await getDbg(page);
  // autoTrack must be false after drag
  expect(dbg.surfaceAutoTrack).toBe(false);

  // With autoTrack off, sprite follows actual Sun direction (not camera look).
  // After 200px drag (~34° yaw), camera has turned, so sprite should no longer
  // be at screen center. Either x or y NDC must have changed by > 0.15.
  const moved = Math.abs(dbg.spriteScreenX - cx) > 0.15 ||
                Math.abs(dbg.spriteScreenY - cy) > 0.15;
  expect(moved).toBe(true);

  // Press R to re-enable autoTrack
  await page.keyboard.press('r');
  await page.waitForTimeout(300);
  dbg = await getDbg(page);
  expect(dbg.surfaceAutoTrack).toBe(true);
  expect(dbg.spriteOnScreen).toBe(true);
});

test('nighttime: sun sprite hidden', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.click('#btnSpring');
  await page.waitForTimeout(500);
  await page.click('#modeEarthSurf');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__selectSurfacePoint(0, 0));
  await page.waitForTimeout(300);
  await page.click('#confirm-btn');
  await page.waitForTimeout(1000);

  // Advance to nighttime (offset where sunAlt < -10°)
  await page.evaluate(() => window.__setSimDayOffset(0.5));
  await page.waitForTimeout(500);
  await page.keyboard.press('r');
  await page.waitForTimeout(200);

  const dbg = await getDbg(page);
  expect(dbg.debugSunAlt * 180 / Math.PI).toBeLessThan(-3);
  expect(dbg.sunSpriteVisible).toBe(false);
});
