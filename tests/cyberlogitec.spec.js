// File: tests/cyberlogitec.spec.js

// @ts-check
const fs = require('fs');
const fsp = require('fs/promises');
const { test, expect } = require('@playwright/test');
// const core = require('@actions/core'); // <-- ĐÃ XÓA
const { uploadToCloudinary } = require('../utils/cloudinary');
require('dotenv').config();

const { CYBERLOGITEC_USERNAME, CYBERLOGITEC_PASSWORD } = process.env;

// --- BẮT ĐẦU SỬA (Thêm hàm setOutput) ---
/**
 * Ghi output cho GitHub Actions (nếu đang chạy trong GHA)
 * @param {string} name - Tên output
 * @param {string} value - Giá trị output
 */
function setGhaOutput(name, value) {
  try {
    if (process.env.GITHUB_OUTPUT) {
      // Ghi vào file GITHUB_OUTPUT
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
      console.log(`Successfully set GHA output: ${name}`);
    } else {
      console.log(`GHA output (local): ${name} = ${value}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to write GHA output ${name}: ${msg}`);
  }
}
// --- KẾT THÚC SỬA ---

/**
 * Checks if the page is closed and throws a standardized error if it is.
 * @param {import('@playwright/test').Page} page
 * @param {string} label
 */
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
  test.setTimeout(150000);

  let punchTime = '';

  try {
    // (Giữ nguyên Step 1: Login)
    await test.step('Navigate to Login Page and Perform Login', async () => {
      await page.goto('https://blueprint.cyberlogitec.com.vn/', {
        waitUntil: 'networkidle',
        timeout: 60000,
      });
      if (!CYBERLOGITEC_USERNAME || !CYBERLOGITEC_PASSWORD) {
        throw new Error('Username or Password is not defined in .env file.');
      }
      await page.locator('#username').fill(CYBERLOGITEC_USERNAME);
      await page.locator('#password').fill(CYBERLOGITEC_PASSWORD);
      await page.locator('#submit-btn').click();
      await waitNetworkIdle(page, 45000, 'post-login');
      ensurePageAlive(page, 'post-login');
    });

    // (Giữ nguyên Step 2: Navigate)
    await test.step('Navigate to Check In/Out Page', async () => {
      async function runSidebarNav() {
        ensurePageAlive(page, 'nav-start');
        await page.locator('.mtos-btnMnu').click();
        const sidebar = page.locator('div.webix_sidebar');
        await expect(sidebar).toBeVisible({ timeout: 30000 });
        const attendanceMenu = sidebar
          .locator('div.webix_tree_item')
          .filter({ hasText: /Attendance/i })
          .first();
        await attendanceMenu.scrollIntoViewIfNeeded();
        await expect(attendanceMenu).toBeVisible({ timeout: 20000 });
        await attendanceMenu.click();
        const checkInOutMenu = sidebar
          .locator('div.webix_tree_item')
          .filter({ hasText: /Check In\/Out/i })
          .first();
        await checkInOutMenu.scrollIntoViewIfNeeded();
        await expect(checkInOutMenu).toBeVisible({ timeout: 20000 });
        await checkInOutMenu.click();
        await waitNetworkIdle(page, 30000, 'post-check-in-out');
      }
      try {
        await runSidebarNav();
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes('Timeout') || error.message.includes('not visible'))
        ) {
          await runSidebarNav();
        } else {
          throw error;
        }
      }
      ensurePageAlive(page, 'post-sidebar-nav');
    });

    // (Giữ nguyên Step 3: Punch)
    await test.step('Perform Punch In/Out', async () => {
      const punchButton = page.getByRole('button', { name: /Punch In\/Out/i });
      await expect(punchButton).toBeVisible({ timeout: 20000 });
      await punchButton.click();
      await page.waitForTimeout(7000);
      ensurePageAlive(page, 'after-punch-delay');
    });

    // (Giữ nguyên Step 4: Screenshot)
    await test.step('Capture, Upload, and Notify', async () => {
      await page
        .locator('div.webix_dtable[role="grid"]')
        .first()
        .waitFor({ state: 'visible', timeout: 30000 });

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

      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        timeout: 30000,
      });

      let screenshotBuffer;
      try {
        screenshotBuffer = await fsp.readFile(screenshotPath);
      } catch (fileError) {
        const msg = fileError instanceof Error ? fileError.message : String(fileError);
        throw new Error(`[RF_SCREENSHOT_FAIL] Unable to read screenshot file: ${msg}`);
      }

      if (!screenshotBuffer) {
        throw new Error('[RF_SCREENSHOT_FAIL] Screenshot buffer is empty.');
      }

      const imageUrl = await uploadToCloudinary(screenshotBuffer);

      setGhaOutput('image_url', imageUrl);
      setGhaOutput('punch_time', punchTime);
      setGhaOutput('error_message', '');
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
        await page.screenshot({
          path: errorScreenshotPath,
          fullPage: true,
          timeout: 30000,
        });
        const errorBuffer = await fsp.readFile(errorScreenshotPath);
        failureImageUrl = await uploadToCloudinary(errorBuffer);
      } catch (screenshotError) {
        const msg =
          screenshotError instanceof Error ? screenshotError.message : String(screenshotError);
        console.error(`Failed to take or upload failure screenshot: ${msg}`);
      }
    }

    setGhaOutput('image_url', failureImageUrl);
    setGhaOutput('punch_time', '');
    setGhaOutput('error_message', errorMessage);

    throw error;
  } finally {
    if (!page.isClosed()) {
      try {
        await page.close({ runBeforeUnload: false });
      } catch (closeError) {
        const msg = closeError instanceof Error ? closeError.message : String(closeError);
        console.error(`Failed to close page during cleanup: ${msg}`);
      }
    }
  }
});
