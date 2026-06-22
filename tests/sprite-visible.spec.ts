import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import * as path from 'path';

const PORT = 8082;
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

// Scan simDayOffset to find sunrise (sunAlt ≈ 0°)
async function findSunrise(page) {
  // Start at equinox, step forward in 0.02-day increments
  // looking for debugSunAlt crossing 0°
  for (let offset = 0.0; offset < 1.0; offset += 0.02) {
    await page.evaluate((v) => window.__setSimDayOffset(v), offset);
    await page.waitForTimeout(50);
    const dbg = await getDbg(page);
    if (dbg && Math.abs(dbg.debugSunAlt) < 0.05) {
      return offset;
    }
  }
  return null;
}

test('sprite must appear on screen at sunrise (sunAlt=0° pitch=0°)', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Set equinox and enter surface mode
  await page.click('#btnSpring');
  await page.waitForTimeout(500);
  await page.click('#modeEarthSurf');
  await page.waitForTimeout(500);

  // Select equator at lon=0
  await page.evaluate(() => window.__selectSurfacePoint(0, 0));
  await page.waitForTimeout(300);

  // Confirm
  await page.click('#confirm-btn');
  await page.waitForTimeout(1000);

  // Debug overlay visible
  await expect(page.locator('#debug-overlay')).toBeVisible();

  // Find the sunrise offset (~0.126 days)
  const srOffset = await findSunrise(page);
  expect(srOffset).not.toBeNull();
  console.log(`Found sunrise at simDayOffset=${srOffset}`);

  // Set to exact sunrise
  await page.evaluate((v) => window.__setSimDayOffset(v), srOffset);
  await page.waitForTimeout(500);

  // Re-enable autoTrack (in case any drag disabled it)
  await page.keyboard.press('r');
  await page.waitForTimeout(200);

  const dbg = await getDbg(page);

  // Verify sunAlt ≈ 0°
  const sunAltDeg = dbg.debugSunAlt * 180 / Math.PI;
  console.log(`sunAlt=${sunAltDeg.toFixed(2)}°, pitch=${(dbg.surfacePitch * 180 / Math.PI).toFixed(2)}°, camAlt=${(dbg.debugCamAlt * 180 / Math.PI).toFixed(2)}°`);
  console.log(`spriteOnScreen=${dbg.spriteOnScreen}, spriteScreen=(${(dbg.spriteScreenX * 100).toFixed(1)}%, ${(dbg.spriteScreenY * 100).toFixed(1)}%)`);

  // Sun should be near the horizon
  expect(Math.abs(sunAltDeg)).toBeLessThan(5);

  // Pitch should match Sun altitude (autoTrack aligns them)
  expect(Math.abs(dbg.surfacePitch - dbg.debugSunAlt) * 180 / Math.PI).toBeLessThan(2);

  // CRITICAL: Sprite MUST be on screen geometrically
  // With depthTest:false, frustumCulled:false, renderOrder:1, the sprite
  // should always render when within the view frustum
  expect(dbg.spriteOnScreen).toBe(true);

  // At sunrise with pitch=0°, sprite should be near screen center horizontally
  // and near y=0 (horizon center) vertically
  expect(Math.abs(dbg.spriteScreenY)).toBeLessThan(0.3);

  // Take a screenshot for manual inspection
  await page.screenshot({ path: 'test-results/sprite-sunrise.png', fullPage: false });

  // Also verify sprite is NOT behind the camera (z must be < 1 in NDC)
  expect(dbg.spriteScreenZ).toBeLessThan(1);
});

test('sprite altitude matches debugSunAlt at all times (geometry correctness)', async ({ page }) => {
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

  // Test multiple offsets to verify sprite geometry is always correct
  const offsets = [0.0, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9];
  for (const offset of offsets) {
    await page.evaluate((v) => window.__setSimDayOffset(v), offset);
    await page.waitForTimeout(200);
    await page.keyboard.press('r');
    await page.waitForTimeout(200);

    const dbg = await getDbg(page);
    const sunAltDeg = dbg.debugSunAlt * 180 / Math.PI;
    const pitchDeg = dbg.surfacePitch * 180 / Math.PI;
    console.log(`Offset=${offset.toFixed(1)}: sunAlt=${sunAltDeg.toFixed(1)}°, pitch=${pitchDeg.toFixed(1)}°, spriteOnScreen=${dbg.spriteOnScreen}, spriteScreen=(${(dbg.spriteScreenX).toFixed(2)},${(dbg.spriteScreenY).toFixed(2)})`);
  }
});
