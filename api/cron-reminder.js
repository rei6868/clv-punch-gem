// File: api/cron-reminder.js

const { getIsEnabled, getIsOff, getPeriodState, kv } = require('../lib/kv');
const { getVietnamDateKey, getVietnamTime, isWFHDay, getCurrentPeriod } = require('../lib/time');
const { sendChat } = require('../lib/chat');

// Xác thực Cron Job
const expected = process.env.CRON_SECRET || process.env.PUNCH_SECRET || 'Thanhnam0';

function authenticate(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/, '');
  if (token !== expected) throw new Error('invalid cron secret');
}

/**
 * Gửi thông báo và đặt khóa (lock) để chống spam
 * @param {string} lockKey - Key để khóa
 * @param {number} ttl - Thời gian khóa (giây)
 * @param {Object} chatParams - Tham số cho hàm sendChat
 */
async function sendNotificationWithLock(lockKey, ttl, chatParams) {
  const lock = await kv.get(lockKey);
  if (lock) {
    console.log(`Notification locked (${lockKey}). Skipping.`);
    return { message: 'Skipped: Notification is locked.' };
  }
  
  // Gửi chat và đặt khóa
  await Promise.all([
    sendChat(chatParams),
    kv.set(lockKey, true, { ex: ttl })
  ]);
  
  return { message: `Sent notification: ${chatParams.title}` };
}

export default async function handler(req, res) {
  const rid = req.headers['x-vercel-id'] || Date.now().toString();
  const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
  const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

  if (req.method !== 'GET' && req.method !== 'POST') {
    return bad(405, 'method not allowed');
  }

  try {
    // 1. Xác thực
    authenticate(req);

    const dateKey = getVietnamDateKey();
    const now = getVietnamTime();
    const currentHour = now.getHours(); // 0-23 (Giờ VN)

    // 2. Kiểm tra trạng thái chung
    const isEnabled = await getIsEnabled();
    if (!isEnabled) {
      return ok({ message: 'Skipped reminder: System is disabled.' });
    }

    const isOff = await getIsOff(dateKey);

    // --- Logic rẽ nhánh ---

    // 3. Logic ngày OFF (ưu tiên cao nhất)
    if (isOff) {
      // Chỉ gửi nhắc nhở "bật lại" vào buổi tối (18:00)
      if (currentHour === 18) {
        const lockKey = `lock:off:${dateKey}`;
        return ok(await sendNotificationWithLock(lockKey, 3600 * 6, { // Khóa 6 tiếng
          title: '🔔 Nhắc nhở (Ngày OFF)',
          message: `Hôm nay (${dateKey}) đã được đánh dấu OFF. Nếu mai đi làm (WFH T3/T4), hãy nhớ BẬT lại hệ thống.`,
          icon: 'config',
        }));
      }
      return ok({ message: `Skipped reminder: Day ${dateKey} is OFF.` });
    }

    // 4. Logic ngày WFH (T3/T4)
    if (isWFHDay(now)) {
      const period = (currentHour < 13) ? 'am' : 'pm';
      const state = await getPeriodState(dateKey, period);
      const status = (state && state.status) || 'pending';
      
      // Nếu đã Success hoặc Manual Done -> Bỏ qua
      if (status === 'success' || status === 'manual_done') {
        return ok({ message: `Skipped reminder: Period ${period} is already '${status}'.` });
      }

      // (status là 'pending' hoặc 'fail')
      let chatParams = null;
      let lockKey = `lock:${dateKey}:${period}`;
      const lockTTL = 60 * 15; // Khóa 15 phút giữa các lần nhắc

      if (period === 'am' && currentHour >= 6 && currentHour <= 8) {
        // Nhắc nhở AM (06:00 - 08:59)
        if (currentHour === 8 && now.getMinutes() >= 30) {
          // 08:30 - Cảnh báo trễ deadline
          lockKey = `lock:${dateKey}:am:final`; // Khóa cuối ngày
          chatParams = {
            title: '⛔ CẢNH BÁO (AM) - TRỄ DEADLINE',
            message: 'Đã 08:30. GHA đã thất bại hoặc không chạy. Vui lòng tự Punch In và "Mark DONE" thủ công ngay!',
            icon: 'failure',
          };
        } else {
          // Nhắc nhở thông thường
          chatParams = {
            title: '🔔 Nhắc nhở Punch In (Sáng)',
            message: `Hệ thống đang ở trạng thái "${status}". Vui lòng kiểm tra, hoặc "Mark DONE" nếu đã làm thủ công.`,
            icon: 'info',
          };
        }
      } else if (period === 'pm' && currentHour >= 18 && currentHour <= 20) {
        // Nhắc nhở PM (18:00 - 20:59)
         if (currentHour === 20) {
            lockKey = `lock:${dateKey}:pm:final`;
            chatParams = {
              title: '⛔ CẢNH BÁO (PM) - TRỄ DEADLINE',
              message: 'Đã 20:00. Vui lòng tự Punch Out và "Mark DONE" thủ công ngay!',
              icon: 'failure',
            };
         } else {
            chatParams = {
              title: '🔔 Nhắc nhở Punch Out (Chiều)',
              message: `Hệ thống đang ở trạng thái "${status}". Vui lòng kiểm tra, hoặc "Mark DONE" nếu đã làm thủ công.`,
              icon: 'info',
            };
         }
      }

      if (chatParams) {
        return ok(await sendNotificationWithLock(lockKey, lockTTL, chatParams));
      }
      return ok({ message: `Skipped WFH reminder: Not in valid time window (Hour: ${currentHour}).` });
    }

    // 5. Logic ngày Văn phòng (Không phải T3/T4, không OFF)
    // Chỉ chạy 1 lần lúc 07:45
    if (currentHour === 7 && now.getMinutes() >= 45) {
      const lockKey = `lock:office:${dateKey}`;
      return ok(await sendNotificationWithLock(lockKey, 3600 * 12, { // Khóa 12 tiếng
        title: '🏢 Nhắc nhở (Ngày Văn Phòng)',
        message: 'Hôm nay là ngày lên văn phòng. Đừng quên tự check-in nhé!',
        icon: 'info',
      }));
    }

    return ok({ message: 'Skipped: No action required for this time.' });

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    await sendChat({ title: '🚨 LỖI CRON REMINDER', message: msg, icon: 'failure' });
    return bad(500, 'cron-reminder error', { detail: msg });
  }
}