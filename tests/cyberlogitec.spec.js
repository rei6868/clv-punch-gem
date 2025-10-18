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

    // Bước 3: Điều hướng đến trang Check In/Out (SỬA LỖI FLAKY)
    await test.step('Navigate to Check In/Out Page', async () => {
      await page.locator('.mtos-btnMnu').click();
      
      // === SỬA LỖI Ở ĐÂY ===
      // Bỏ `expect` riêng. Gộp vào lệnh click và cho nó 20 giây để tìm.
      // Playwright sẽ tự động chờ element `visible` trước khi click.
      const attendanceMenu = page.locator('div[role="treeitem"]:has-text("Attendance")');
      await attendanceMenu.click({ timeout: 20000 });
      
      const checkInOutMenu = page.getByText('Check In/Out', { exact: true });
      await checkInOutMenu.click({ timeout: 15000 });
    });

    // Bước 4: Thực hiện Punch In/Out (Vẫn giữ bản fix chờ spinner)
    await test.step('Perform Punch In/Out', async () => {
      const punchButton = page.getByRole('button', { name: 'Punch In/Out' });
      await expect(punchButton).toBeVisible({ timeout: 45000 });
      await punchButton.click();
      
      const loadingOverlay = page.locator('div.webix_loading_cover');
      await expect(loadingOverlay).toBeHidden({ timeout: 30000 });
      await page.waitForTimeout(3000);
    });

    // Bước 5: Chụp ảnh, upload và gửi thông báo
    await test.step('Capture, Upload and Notify', async () => {
      const mainTableAreaLocator = page.locator('div.webix_dtable[role="grid"]').first();
      await expect(mainTableAreaLocator).toBeVisible({ timeout: 15000 });
      const screenshotBuffer = await mainTableAreaLocator.screenshot();
      
      const imageUrl = await uploadToCloudinary(screenshotBuffer);
      await sendGoogleChatNotification(true, imageUrl);
    });

  } catch (error) {
    const errorMessage = error.message || 'An unknown error occurred.';
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