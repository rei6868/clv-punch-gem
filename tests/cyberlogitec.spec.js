// @ts-check
const { test, expect } = require('@playwright/test');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { sendGoogleChatNotification } = require('../utils/googleChat');
require('dotenv').config();

const { CYBERLOGITEC_USERNAME, CYBERLOGITEC_PASSWORD } = process.env;

test('Cyberlogitec Blueprint Punch In/Out', async ({ page }) => {
  test.setTimeout(120000); 

  try {
    // Bước 1: Điều hướng đến trang đăng nhập
    await test.step('Navigate to Login Page', async () => {
      await page.goto('https://blueprint.cyberlogitec.com.vn/', { timeout: 60000 });
    });

    // Bước 2: Thực hiện đăng nhập
    await test.step('Perform Login', async () => {
      if (!CYBERLOGITEC_USERNAME || !CYBERLOGITEC_PASSWORD) {
        throw new Error('Username or Password is not defined in .env file.');
      }
      await page.locator('#username').fill(CYBERLOGITEC_USERNAME);
      await page.locator('#password').fill(CYBERLOGITEC_PASSWORD);
      await page.locator('#submit-btn').click();
      const hamburgerMenu = page.locator('.mtos-btnMnu');
      await expect(hamburgerMenu).toBeVisible({ timeout: 90000 });
    });

    // Bước 3: Điều hướng đến trang Check In/Out (SỬA LỖI FLAKY v14.0)
    await test.step('Navigate to Check In/Out Page', async () => {
      await page.locator('.mtos-btnMnu').click();
      
      // === SỬA LỖI FLAKY (Bản vá 14.0 - locator('visible=true')) ===

      // 1. Tìm 'Attendance' (exact) VÀ (visible=true)
      // Cách này giải quyết lỗi "6 elements"
      const attendanceMenu = page.getByText('Attendance', { exact: true }).locator('visible=true');
      await attendanceMenu.click({ timeout: 15000 });
      
      // 2. Tìm 'Check In/Out' (exact) VÀ (visible=true)
      const checkInOutMenu = page.getByText('Check In/Out', { exact: true }).locator('visible=true');
      await checkInOutMenu.click({ timeout: 10000 });
    });

    // Bước 4: Thực hiện Punch In/Out
    await test.step('Perform Punch In/Out', async () => {
      const punchButton = page.getByRole('button', { name: 'Punch In/Out' });
      await expect(punchButton).toBeVisible({ timeout: 45000 });
      await punchButton.click();
      
      const loadingOverlay = page.locator('div.webix_loading_cover');
      await expect(loadingOverlay).toBeHidden({ timeout: 30000 });
    });

    // Bước 5: Chụp ảnh, upload và gửi thông báo (Bản vá 9.0)
    await test.step('Capture, Upload and Notify', async () => {
      const mainTableAreaLocator = page.locator('div.webix_dtable[role="grid"]:has-text("Working Holiday")');
      
      await expect(mainTableAreaLocator).toBeVisible({ timeout: 15000 }); 
      
      const screenshotBuffer = await mainTableAreaLocator.screenshot();
      const imageUrl = await uploadToCloudinary(screenshotBuffer);
      await sendGoogleChatNotification(true, imageUrl);
    });

  } catch (error) {
    // SỬA LỖI 'error' is of type 'unknown' (ts:18046)
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    console.error(`Test failed: ${errorMessage}`);

    if (!page.isClosed()) {
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        const imageUrl = await uploadToCloudinary(screenshotBuffer);
        await sendGoogleChatNotification(false, imageUrl, errorMessage);
    } else {
        await sendGoogleChatNotification(false, 'https://i.imgur.com/K6b4F0L.png', `Test failed critically and the page was closed. Error: ${errorMessage}`);
    }
    
    throw error;
  }
});
