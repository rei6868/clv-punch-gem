// @ts-check
const { test, expect } = require('@playwright/test');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { sendGoogleChatNotification } = require('../utils/googleChat');
require('dotenv').config();

const { CYBERLOGITEC_USERNAME, CYBERLOGITEC_PASSWORD } = process.env;

// (Yêu cầu B) Hàm trợ giúp để lấy ngày hôm nay theo format "Oct DD, YYYY"
function getTodayDateString() {
  const today = new Date();
  // Định dạng ngày theo múi giờ Việt Nam
  return today.toLocaleDateString('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).replace(',', ''); // Xóa dấu phẩy (ví dụ: "Oct 21 2025")
}

test('Cyberlogitec Blueprint Punch In/Out', async ({ page }) => {
  test.setTimeout(120000); 
  let recordedPunchTime = ''; // (Yêu cầu B) Biến để lưu thời gian

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

    // Bước 3: Điều hướng đến trang Check In/Out (v20.0 - Đã Pass 325ms)
    await test.step('Navigate to Check In/Out Page', async () => {
      await page.locator('.mtos-btnMnu').click();
      
      const sidebarContainer = page.locator('div.webix_sidebar');
      await expect(sidebarContainer).toBeVisible({ timeout: 15000 });

      await expect(sidebarContainer.locator('div.webix_tree_item').first()).toBeVisible({ timeout: 10000 });
      
      const attendanceMenu = sidebarContainer.locator('div.webix_tree_item:has-text("Attendance")');
      await attendanceMenu.click({ timeout: 10000 });
      
      const checkInOutMenu = sidebarContainer.locator('div.webix_tree_item:has-text("Check In/Out")');
      await checkInOutMenu.click({ timeout: 10000 });
    });

    // Bước 4: Thực hiện Punch In/Out (SỬA LỖI v21.0 - Xóa 'wait')
    await test.step('Perform Punch In/Out', async () => {
      const punchButton = page.getByRole('button', { name: 'Punch In/Out' });
      await expect(punchButton).toBeVisible({ timeout: 45000 });
      await punchButton.click();
      
      // Chờ spinner biến mất. Đây là "smart wait" DUY NHẤT
      // chúng ta cần để biết table đã refresh.
      const loadingOverlay = page.locator('div.webix_loading_cover');
      await expect(loadingOverlay).toBeHidden({ timeout: 30000 });

      // === SỬA LỖI CRASH (Bản vá 21.0) ===
      // XÓA BỎ: await page.waitForLoadState('networkidle');
      // (Vì nó gây crash)
    });

    // Bước 5: Đọc thời gian, Chụp ảnh và Gửi thông báo (v15.0)
    await test.step('Capture, Read Time, Upload and Notify', async () => {
      const mainTableAreaLocator = page.locator('div.webix_dtable[role="grid"]:has-text("Working Holiday")');
      await expect(mainTableAreaLocator).toBeVisible({ timeout: 15000 }); 

      // (Yêu cầu B) Tìm hàng (row) của ngày hôm nay
      const todayDate = getTodayDateString(); // Ví dụ: "Oct 21 2025"
      const todayRowLocator = mainTableAreaLocator.locator('div[role="row"]', { hasText: todayDate });
      
      // Đọc thời gian Punch In hoặc Punch Out
      try {
        const currentHourVN = parseInt(new Date().toLocaleTimeString('en-US', { hour: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }));
        
        let cellLocator;
        if (currentHourVN < 13) {
          // Buổi sáng (Punch In): Đọc cột thứ 2 (In)
          cellLocator = todayRowLocator.locator('div[role="gridcell"]').nth(1);
        } else {
          // Buổi chiều (Punch Out): Đọc cột thứ 3 (Out)
          cellLocator = todayRowLocator.locator('div[role="gridcell"]').nth(2);
        }
        
        const punchTime = await cellLocator.innerText();
        recordedPunchTime = punchTime.trim(); // Ví dụ: "06:31"
      } catch (readTimeError) {
        console.warn(`Could not read punch time from UI: ${readTimeError.message}`);
        recordedPunchTime = ''; // Bỏ qua nếu không đọc được
      }

      // (Yêu cầu A) Chụp ảnh SAU KHI đã chờ (ở Bước 4)
      const screenshotBuffer = await mainTableAreaLocator.screenshot();
      const imageUrl = await uploadToCloudinary(screenshotBuffer);
      
      // (Yêu cầu B) Gửi thời gian đã đọc được
      await sendGoogleChatNotification(true, imageUrl, '', recordedPunchTime);
    });

  } catch (error) {
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    console.error(`Test failed: ${errorMessage}`);

    if (!page.isClosed()) {
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        const imageUrl = await uploadToCloudinary(screenshotBuffer);
        await sendGoogleChatNotification(false, imageUrl, errorMessage, '');
    } else {
        // Đây là lỗi crash
        const crashMessage = `Test failed critically and the page was closed. Error: ${errorMessage}`;
        console.error(crashMessage);
        // Gửi placeholder (sẽ được googleChat.js xử lý)
        await sendGoogleChatNotification(false, 'https://i.imgur.com/K6b4F0L.png', crashMessage, '');
    }
    
    throw error;
  }
});
