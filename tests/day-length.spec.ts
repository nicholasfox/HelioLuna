import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import * as path from 'path';

const PORT = 8081;
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

test('debug overlay shows correct values in surface mode', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Set equinox and enter surface mode
  await page.click('#btnSpring');
  await page.waitForTimeout(500);
  await page.click('#modeEarthSurf');
  await page.waitForTimeout(500);

  // Programmatically select equator at lon=0
  await page.evaluate(() => window.__selectSurfacePoint(0, 0));
  await page.waitForTimeout(300);

  // Confirm
  await page.click('#confirm-btn');
  await page.waitForTimeout(1000);

  // Debug overlay should be visible
  const debugEl = page.locator('#debug-overlay');
  await expect(debugEl).toBeVisible();

  const text = await debugEl.textContent();
  expect(text).toContain('太阳高度');
  expect(text).toContain('相机实际俯仰');
  expect(text).toContain('相机偏航');

  const dbg = await getDbg(page);
  expect(typeof dbg.debugSunAlt).toBe('number');
  expect(typeof dbg.debugSunAltCenter).toBe('number');
});

test('parallax fix: observer altitude differs from center altitude', async ({ page }) => {
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

  const dbg = await getDbg(page);
  const diffRad = Math.abs(dbg.debugSunAlt - dbg.debugSunAltCenter);
  // Real‑scale Earth (R=1): observer at R=1.015 from center, Earth at ~12
  // from Sun → surface‑vs‑center parallax is atan(1/12) ≈ 4.8°.
  const diffDeg = diffRad * 180 / Math.PI;
  expect(diffDeg).toBeGreaterThan(0.5);
  expect(diffDeg).toBeLessThan(5);
});

test('day length at equator at equinox is ~12 hours at 1h/s speed', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Set equinox
  await page.click('#btnSpring');
  await page.waitForTimeout(500);

  // Set speed to 1 hour/second
  await page.selectOption('#speedSelect', '0.0417');
  await page.waitForTimeout(200);

  // Enter surface mode and select equator
  await page.click('#modeEarthSurf');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__selectSurfacePoint(0, 0));
  await page.waitForTimeout(300);
  await page.click('#confirm-btn');
  await page.waitForTimeout(1000);

  // Read initial state
  let dbg = await getDbg(page);
  console.log(`Initial: alt=${(dbg.debugSunAlt * 180 / Math.PI).toFixed(1)}° centerAlt=${(dbg.debugSunAltCenter * 180 / Math.PI).toFixed(1)}°`);

  // Start playing at 1 hour/s
  await page.click('#playBtn');
  const startTime = Date.now();

  // Sample altitude every 100ms for 40s
  const samples = [];
  for (let i = 0; i < 400; i++) {
    await page.waitForTimeout(100);
    dbg = await getDbg(page);
    if (dbg && dbg.playing) {
      samples.push({
        t: (Date.now() - startTime) / 1000,
        alt: dbg.debugSunAlt,
        altCenter: dbg.debugSunAltCenter,
        dayOff: dbg.simDayOffset,
      });
    }
  }

  await page.click('#playBtn');
  console.log(`Collected ${samples.length} samples`);

  // We need enough samples
  expect(samples.length).toBeGreaterThan(50);

  // Find the time range where Sun is above the horizon
  const aboveHorizon = samples.filter(s => s.alt > 0);
  const belowHorizon = samples.filter(s => s.alt <= 0);

  console.log(`Daylight samples: ${aboveHorizon.length}, Night samples: ${belowHorizon.length}`);
  console.log(`Daylight duration: ${(aboveHorizon.length * 0.1).toFixed(1)}s`);

  // Must have both day and night in the 40s window
  expect(belowHorizon.length).toBeGreaterThan(10);
  expect(aboveHorizon.length).toBeGreaterThan(10);

  // At 1h/s, 12h daylight = 12s. Allow ±6s for initial offset.
  const daySeconds = aboveHorizon.length * 0.1;
  expect(daySeconds).toBeGreaterThan(4);
  expect(daySeconds).toBeLessThan(24);

  // Verify altitude arc: Sun should reach a peak > 10° during daytime
  const maxAlt = Math.max(...aboveHorizon.map(s => s.alt));
  expect(maxAlt).toBeGreaterThan(10 * Math.PI / 180);
});

test('autoTrack keeps camera aligned with Sun', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Spring equinox at equator
  await page.click('#btnSpring');
  await page.waitForTimeout(500);
  await page.click('#modeEarthSurf');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__selectSurfacePoint(0, 0));
  await page.waitForTimeout(300);
  await page.click('#confirm-btn');
  await page.waitForTimeout(1000);

  // Advance time to ~0.25 days so longitude 0° faces Sun (local noon)
  await page.evaluate(() => window.__setSimDayOffset(0.25));
  await page.waitForTimeout(500);

  const dbg = await getDbg(page);

  // Sun should be well above the horizon (>30° at noon near equator equinox)
  expect(dbg.debugSunAlt * 180 / Math.PI).toBeGreaterThan(30);

  // surfacePitch should match debugSunAlt (auto-tracked altitude from obsCelestial)
  const pitchDeg = dbg.surfacePitch * 180 / Math.PI;
  const sunAltDeg = dbg.debugSunAlt * 180 / Math.PI;
  expect(Math.abs(pitchDeg - sunAltDeg)).toBeLessThan(1);

  // Camera's actual look direction should match surfacePitch
  const camAltDeg = dbg.debugCamAlt * 180 / Math.PI;
  expect(Math.abs(camAltDeg - pitchDeg)).toBeLessThan(0.5);

  // Debug overlay should show camera info
  const overlay = page.locator('#debug-overlay');
  const text = await overlay.textContent();
  expect(text).toContain('相机实际俯仰');
  expect(text).toContain('autoTrack');
});
