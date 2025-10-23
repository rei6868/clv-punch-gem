// File: tests/cyberlogitec.spec.js

// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs/promises');
// const core = require('@actions/core'); // <-- ĐÃ XÓA
const { uploadToCloudinary } = require('../utils/cloudinary');
require('dotenv').config();

const { CYBERLOGITEC_USERNAME, CYBERLOGITEC_PASSWORD } = process.env;

// --- Thêm hàm GITHUB_OUTPUT ---
/**
 * Ghi output cho GitHub Actions.
 * @param {string} key
 * @param {string} value
 */
async function setOutput(key, value) {
  const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT;
  if (GITHUB_OUTPUT) {
    // Ghi vào file GITHUB_OUTPUT
    await fs.appendFile(GITHUB_OUTPUT, `${key}=${value}\n`);
    console.log(`Set GHA output: ${key}=${value}`);
  } else {
    console.log(`(Not in GHA) Output: ${key}=${value}`);
  }
}
// --- Kết thúc thêm hàm ---

// (Giữ nguyên các hàm: ensurePageAlive, waitNetworkIdle)
function ensurePageAlive(page, label) {
  if (page.isClosed()) {
    throw new Error(`[RF_PAGE_CLOSED] during ${label}`);
  }
}
async function waitNetworkIdle(page, timeout = 45000, label = 'networkidle') {
  ensurePageAlive(page, `before ${label}`);
  await page.waitForLoadState('networkidle', { timeout });
}


test('Cyberlogitec Blueprint Punch In/Out', async ({ page }) => {
  // (Giữ nguyên timeout)
  test.setTimeout(150000); 
  let punchTime = '';

  try {
    // (Giữ nguyên Step 1, 2, 3)
    await test.step('Navigate to Login Page and Perform Login', async () => {
      await page.goto('https://blueprint.cyberlogitec.com.vn/', { waitUntil: 'networkidle', timeout: 60000 });
      if (!CYBERLOGITEC_USERNAME || !CYBERLOGITEC_PASSWORD) {
        throw new Error('Username or Password is not defined in .env file.');
      }
      await page.locator('#username').fill(CYBERLOGITEC_USERNAME);
      await page.locator('#password').fill(CYBERLOGITEC_PASSWORD);
      await page.locator('#submit-btn').click();
      await waitNetworkIdle(page, 45000, 'post-login');
      ensurePageAlive(page, 'post-login');
    });
    await test.step('Navigate to Check In/Out Page', async () => {
      async function runSidebarNav() {
        ensurePageAlive(page, 'nav-start');
        await page.locator('.mtos-btnMnu').click();
        const sidebar = page.locator('div.webix_sidebar');
        await expect(sidebar).toBeVisible({ timeout: 30000 });
        const attendanceMenu = sidebar.locator('div.webix_tree_item').filter({ hasText: /Attendance/i }).first();
        await attendanceMenu.scrollIntoViewIfNeeded();
        await expect(attendanceMenu).toBeVisible({ timeout: 20000 });
        await attendanceMenu.click();
        const checkInOutMenu = sidebar.locator('div.webix_tree_item').filter({ hasText: /Check In\/Out/i }).first();
        await checkInOutMenu.scrollIntoViewIfNeeded();
        await expect(checkInOutMenu).toBeVisible({ timeout: 20000 });
        await checkInOutMenu.click();
        await waitNetworkIdle(page, 30000, 'post-check-in-out');
      }
      try {
        await runSidebarNav();
      } catch (error) {
        if (error instanceof Error && (error.message.includes('Timeout') || error.message.includes('not visible'))) {
          await runSidebarNav();
        } else {
          throw error;
        }
      }
      ensurePageAlive(page, 'post-sidebar-nav');
    });
    await test.step('Perform Punch In/Out', async () => {
      const punchButton = page.getByRole('button', { name: /Punch In\/Out/i });
      await expect(punchButton).toBeVisible({ timeout: 20000 });
      await punchButton.click();
      await page.waitForTimeout(7000);
      ensurePageAlive(page, 'after-punch-delay');
    });

    // (Step 4: Sửa lại để dùng setOutput)
    await test.step('Capture, Upload, and Notify', async () => {
      // (Giữ nguyên logic chụp ảnh)
      const leaveHeaderLocator = page.getByRole('columnheader', { name: /Leave Request/i });
      const mainTable = page
        .locator('div.webix_dtable[role="grid"]')
        .filter({ has: leaveHeaderLocator })
        .first();
      let tableVisible = false;
      try {
        await mainTable.scrollIntoViewIfNeeded();
        await mainTable.waitFor({ state: 'visible', timeout: 15000 });
        await leaveHeaderLocator.waitFor({ state: 'visible', timeout: 10000 });
        tableVisible = true;
      } catch (_) {
        tableVisible = false;
      }
      const vnDateTime = new Date().toLocaleString('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      punchTime = vnDateTime.replace(/[/:,\s]/g, '-');
      const screenshotPath = 'final_result.png';
      if (!tableVisible) {
        console.warn('[RF_SCREENSHOT_FAIL] Target grid hidden; capturing full page screenshot.');
        await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 30000 });
      } else {
        const tableBox = await mainTable.boundingBox();
        const headerBox = await leaveHeaderLocator.boundingBox();
        if (!tableBox || !headerBox) {
          console.warn('[RF_SCREENSHOT_FAIL] Missing bounding box data; capturing full page screenshot.');
          await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 30000 });
        } else {
          const paddingRight = 5;
          const clipWidth = Math.max(0, headerBox.x - tableBox.x - paddingRight);
          const clipHeight = Math.max(0, tableBox.height);
          if (clipWidth < 30 || clipHeight < 30) {
            console.warn('[RF_SCREENSHOT_FAIL] Clip dimensions too small; capturing full page screenshot instead.');
            await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 30000 });
          } else {
            await page.screenshot({
              path: screenshotPath,
              clip: { x: tableBox.x, y: tableBox.y, width: clipWidth, height: clipHeight },
              timeout: 30000,
            });
          }
        }
      }
      let screenshotBuffer;
      try {
        screenshotBuffer = await fs.readFile(screenshotPath);
      } catch (fileError) {
        throw new Error(`[RF_SCREENSHOT_FAIL] Unable to read screenshot file: ${fileError.message}`);
      }
      if (!screenshotBuffer) {
        throw new Error('[RF_SCREENSHOT_FAIL] Screenshot buffer is empty.');
      }
      const imageUrl = await uploadToCloudinary(screenshotBuffer);

      // --- SỬA CÚ PHÁP GHI OUTPUT ---
      await setOutput('image_url', imageUrl);
      await setOutput('punch_time', punchTime);
      await setOutput('error_message', '');
      // --- KẾT THÚC SỬA ---
    });

  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error(`Test failed: ${errorMessage}`);
    let failureImageUrl = '';
    if (!/\[RF_/.test(errorMessage)) {
      errorMessage = `[RF_FAILURE] ${errorMessage}`;
    }
    const pageClosed = page.isClosed();
    if (pageClosed && !/\[RF_PAGE_CLOSED]/.test(errorMessage)) {
      errorMessage = `${errorMessage} [RF_PAGE_CLOSED]`;
    }
    if (!pageClosed) {
      try {
        const errorScreenshotPath = 'error_screenshot.png';
        await page.screenshot({ path: errorScreenshotPath, fullPage: true, timeout: 30000 });
        const errorBuffer = await fs.readFile(errorScreenshotPath);
        failureImageUrl = await uploadToCloudinary(errorBuffer);
      } catch (screenshotError) {
        console.error(`Failed to take or upload failure screenshot: ${screenshotError.message}`);
      }
    }
    
    // --- SỬA CÚ PHÁP GHI OUTPUT ---
    await setOutput('image_url', failureImageUrl);
    await setOutput('punch_time', '');
    await setOutput('error_message', errorMessage);
    // --- KẾT THÚC SỬA ---
    
    throw error;
  } finally {
    // (Giữ nguyên finally)
    if (!page.isClosed()) {
      try {
        await page.close({ runBeforeUnload: false });
      } catch (closeError) {
        const message = closeError instanceof Error ? closeError.message : String(closeError);
        console.error(`Failed to close page during cleanup: ${message}`);
      }
    }
  }
});