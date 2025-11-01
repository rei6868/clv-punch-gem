// File: lib/time.js

const TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Lấy đối tượng Date hiện tại theo múi giờ VN.
 * @returns {Date}
 */
function getVietnamTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Lấy ngày hôm nay theo định dạng YYYY-MM-DD (múi giờ VN).
 * @param {Date | undefined} date - Ngày cụ thể (nếu không có, dùng ngày hiện tại)
 * @returns {string}
 */
function getVietnamDateKey(date) {
  const now = date || getVietnamTime();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Lấy phiên hiện tại (am/pm) theo múi giờ VN.
 * 13:00 (1 giờ chiều) được tính là 'pm'.
 * @returns {'am' | 'pm'}
 */
function getCurrentPeriod() {
  const now = getVietnamTime();
  const hour = now.getHours(); // 0-23
  return hour < 13 ? 'am' : 'pm';
}

/**
 * Lấy định dạng thời gian VN (HH:mm:ss DD/MM/YYYY)
 * @returns {string}
 */
function getVietnamTimestamp() {
  const now = new Date();
  const time = now.toLocaleTimeString('vi-VN', { timeZone: TIMEZONE, hour12: false });
  const date = now.toLocaleDateString('vi-VN', { timeZone: TIMEZONE });
  return `${time} - ${date}`;
}

/**
 * Kiểm tra xem có phải ngày WFH (T3/T4) không.
 * @param {Date | undefined} date - Ngày cụ thể (nếu không có, dùng ngày hiện tại)
 * @returns {boolean}
 */
function isWFHDay(date) {
  const now = date || getVietnamTime();
  const dayOfWeek = now.getDay(); // 0 = Chủ Nhật, 1 = T2, 2 = T3, 3 = T4
  return dayOfWeek === 2 || dayOfWeek === 3;
}

// --- BẮT ĐẦU THÊM MỚI ---
/**
 * Kiểm tra xem có phải cuối tuần (T7/CN) không.
 * @param {Date | undefined} date - Ngày cụ thể (nếu không có, dùng ngày hiện tại)
 * @returns {boolean}
 */
function isWeekend(date) {
  const now = date || getVietnamTime();
  const dayOfWeek = now.getDay(); // 0 = Chủ Nhật, 6 = Thứ 7
  return dayOfWeek === 0 || dayOfWeek === 6;
}
// --- KẾT THÚC THÊM MỚI ---

module.exports = {
  TIMEZONE,
  getVietnamTime,
  getVietnamDateKey,
  getCurrentPeriod,
  getVietnamTimestamp,
  isWFHDay,
  isWeekend, // <-- Thêm export
};