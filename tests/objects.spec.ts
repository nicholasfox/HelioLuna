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
  // Body labels removed per user request
  expect(dbg.sunLabelVisible).toBeUndefined();
  expect(dbg.earthLabelVisible).toBeUndefined();
  expect(dbg.moonLabelVisible).toBeUndefined();
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

  // Body labels removed per user request
  expect(dbg.sunLabelVisible).toBeUndefined();
  expect(dbg.earthLabelVisible).toBeUndefined();
  expect(dbg.moonLabelVisible).toBeUndefined();
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
  expect(dbg.surfaceAutoTrack).toBe('sun');
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
  expect(dbg.surfaceAutoTrack).toBe('off');

  // With autoTrack off, sprite follows actual Sun direction (not camera look).
  // After 200px drag (~34° yaw), camera has turned, so sprite should no longer
  // be at screen center. Either x or y NDC must have changed by > 0.15.
  const moved = Math.abs(dbg.spriteScreenX - cx) > 0.15 ||
                Math.abs(dbg.spriteScreenY - cy) > 0.15;
  expect(moved).toBe(true);

  // Click the "日" button to re-enable autoTrack
  await page.click('#track-sun');
  await page.waitForTimeout(300);
  dbg = await getDbg(page);
  expect(dbg.surfaceAutoTrack).toBe('sun');
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
  await page.click('#track-sun');
  await page.waitForTimeout(200);

  const dbg = await getDbg(page);
  expect(dbg.debugSunAlt * 180 / Math.PI).toBeLessThan(-3);
  expect(dbg.sunSpriteVisible).toBe(false);
});

test('earth surface: body track keeps moon on screen', async ({ page }) => {
  test.setTimeout(120000);
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

  // Advance time to find when moon is above horizon (moon orbits ~28 days)
  let found = false;
  for (let offset = 0; offset <= 28; offset += 0.5) {
    await page.evaluate((o) => window.__setSimDayOffset(o), offset);
    await page.waitForTimeout(200);
    const dbg = await getDbg(page);
    const altDeg = dbg.debugTargetAlt * 180 / Math.PI;
    if (altDeg > 10) {
      found = true;
      // Switch to body track
      await page.click('#track-body');
      await page.waitForTimeout(1000);

      const dbg2 = await getDbg(page);
      const altDeg2 = dbg2.debugTargetAlt * 180 / Math.PI;
      const pitchDeg = dbg2.surfacePitch * 180 / Math.PI;
      console.log(`moon alt=${altDeg2.toFixed(1)}°, pitch=${pitchDeg.toFixed(1)}°, NDC=(${dbg2.targetBodyScreenX.toFixed(3)}, ${dbg2.targetBodyScreenY.toFixed(3)})`);

      expect(dbg2.surfaceAutoTrack).toBe('body');
      expect(dbg2.targetBodyOnScreen).toBe(true);
      expect(Math.abs(pitchDeg - altDeg2)).toBeLessThan(1);
      expect(Math.abs(dbg2.targetBodyScreenX)).toBeLessThan(0.4);
      expect(Math.abs(dbg2.targetBodyScreenY)).toBeLessThan(0.4);
      break;
    }
  }
  expect(found).toBe(true);
});

test('moon surface: body track keeps earth on screen', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.click('#btnSpring');
  await page.waitForTimeout(500);
  await page.click('#modeMoonSurf');
  await page.waitForTimeout(500);

  // On Moon, sub-Earth point is at lon=-90° (where local +Z points toward Earth)
  await page.evaluate(() => window.__selectSurfacePoint(0, -90));
  await page.waitForTimeout(300);
  await page.click('#confirm-btn');
  await page.waitForTimeout(1000);

  // Switch to body track
  await page.click('#track-body');
  await page.waitForTimeout(1000);

  const dbg = await getDbg(page);
  const altDeg = dbg.debugTargetAlt * 180 / Math.PI;
  const pitchDeg = dbg.surfacePitch * 180 / Math.PI;
  console.log(`earth alt=${altDeg.toFixed(1)}°, pitch=${pitchDeg.toFixed(1)}°, NDC=(${dbg.targetBodyScreenX.toFixed(3)}, ${dbg.targetBodyScreenY.toFixed(3)})`);

  // Earth should be high above horizon at sub-Earth point
  expect(altDeg).toBeGreaterThan(60);
  expect(dbg.surfaceAutoTrack).toBe('body');
  expect(dbg.targetBodyOnScreen).toBe(true);
  expect(Math.abs(pitchDeg - altDeg)).toBeLessThan(1);
  expect(Math.abs(dbg.targetBodyScreenX)).toBeLessThan(0.4);
  expect(Math.abs(dbg.targetBodyScreenY)).toBeLessThan(0.4);
});

test('earth surface: body track jitter test', async ({ page }) => {
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

  // Find time when moon is visible
  await page.evaluate((o) => window.__setSimDayOffset(o), 0);
  await page.waitForTimeout(200);
  let dbg = await getDbg(page);
  let altDeg = dbg.debugTargetAlt * 180 / Math.PI;
  // Scan forward until moon is >10°
  for (let offset = 0; offset <= 28; offset += 0.5) {
    await page.evaluate((o) => window.__setSimDayOffset(o), offset);
    await page.waitForTimeout(200);
    dbg = await getDbg(page);
    altDeg = dbg.debugTargetAlt * 180 / Math.PI;
    if (altDeg > 10) break;
  }

  await page.click('#track-body');
  await page.waitForTimeout(500);

  // Sample 20 frames of debug azimuth
  const samples = [];
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(100);
    dbg = await getDbg(page);
    samples.push({
      targetAz: dbg.debugTargetAz * 180 / Math.PI,
      targetAlt: dbg.debugTargetAlt * 180 / Math.PI,
      pitch: dbg.surfacePitch * 180 / Math.PI,
      yaw: dbg.surfaceYaw * 180 / Math.PI,
      ndcX: dbg.targetBodyScreenX,
      ndcY: dbg.targetBodyScreenY,
    });
  }

  // Check jitter: max-min deviation in azimuth
  const azValues = samples.map(s => s.targetAz);
  const azRange = Math.max(...azValues) - Math.min(...azValues);
  console.log(`azimuth samples: ${azValues.map(v => v.toFixed(3)).join(', ')}`);
  console.log(`azimuth range: ${azRange.toFixed(4)}°`);

  // Azimuth jitter should be < 1° (allow some tiny numerical noise)
  expect(azRange).toBeLessThan(1.0);

  // All samples should have target on screen near center
  for (const s of samples) {
    expect(Math.abs(s.ndcX)).toBeLessThan(0.4);
    expect(Math.abs(s.ndcY)).toBeLessThan(0.4);
  }
});
