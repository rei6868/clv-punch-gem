Auto Punch v2 - Hotfix TaskHello Jules. We need to apply a hotfix to the "Auto Punch v2" project to address an issue with the "Office Day" reminder.Context & Problem:The "Office Day" reminder (for Mon, Thu, Fri) is scheduled via GHA at 07:45 AM (Vietnam Time). However, GHA delays are significant (sometimes 3+ hours), causing the reminder to be sent at 10:45 AM, which is useless.Solution (2-Part Hotfix):GHA (cron-jobs.yml): Move the cron schedule earlier, to 06:15 AM (VN).API (cron-reminder.js): Add a "time gate" to the API. The API will only send the notification if the current time is between 6:00 AM and 7:59 AM (VN). If the GHA job is delayed past 8:00 AM, the API will silently skip the reminder.Please follow these steps exactly.Step 1: Create a new branchPlease create a new branch from main (or the current production branch) with the following name:git checkout -b Gemini-Auto-Punch-Hotfix-Office-Reminder
Step 2: Update .github/workflows/cron-jobs.ymlOverwrite the entire file .github/workflows/cron-jobs.yml with the following content. The key change is in section 3. Office Day Reminder, moving the time from 45 0 * * 1,4,5 (07:45 VN) to 15 23 * * 0,3,4 (06:15 VN).# File: .github/workflows/cron-jobs.yml
name: Vercel Cron Triggers (via GHA)

on:
  workflow_dispatch:
  schedule:
    # (Giờ UTC = Giờ VN - 7)

    # 1. Daily Reset (00:05 VN)
    - cron: '5 17 * * *' # 17:05 UTC

    # 2. WFH AM Reminders (T3, T4)
    # 06:10, 06:20, 06:40 (VN)
    - cron: '10 23 * * 1,2' # 23:10 UTC (T2, T3)
    - cron: '20 23 * * 1,2' # 23:20 UTC (T2, T3)
    - cron: '40 23 * * 1,2' # 23:40 UTC (T2, T3)
    # 07:00, 07:20, 07:40, 08:10, 08:30 (VN)
    - cron: '0 0 * * 2,3' # 00:00 UTC (T3, T4)
    - cron: '20 0 * * 2,3' # 00:20 UTC (T3, T4)
    - cron: '40 0 * * 2,3' # 00:40 UTC (T3, T4)
    - cron: '10 1 * * 2,3' # 01:10 UTC (T3, T4)
    - cron: '30 1 * * 2,3' # 01:30 UTC (T3, T4) - FINAL DEADLINE

    # 3. Office Day Reminder (06:15 VN)
    # (T2, T5, T6)
    # --- HOTFIX: Change schedule to 06:15 VN (23:15 UTC previous day) ---
    - cron: '15 23 * * 0,3,4' # 23:15 UTC (T1, T4, T5) -> 06:15 VN (T2, T5, T6)
    # --- END HOTFIX ---

    # 4. WFH PM Reminders (T3, T4)
    # 18:05, 18:20, 18:40, 19:00, 20:00 (VN)
    - cron: '5 11 * * 2,3' # 11:05 UTC (T3, T4)
    - cron: '20 11 * * 2,3' # 11:20 UTC (T3, T4)
    - cron: '40 11 * * 2,3' # 11:40 UTC (T3, T4)
    - cron: '0 12 * * 2,3' # 12:00 UTC (T3, T4)
    - cron: '0 13 * * 2,3' # 13:00 UTC (T3, T4) - FINAL DEADLINE

    # 5. OFF Day Reminder (18:00 VN - Chạy HÀNG NGÀY)
    - cron: '0 11 * * *' # 11:00 UTC

jobs:
  trigger-vercel-reset:
    name: Trigger Vercel Cron (Reset)
    # Chỉ chạy job này nếu lịch là '5 17 * * *'
    if: github.event.schedule == '5 17 * * *'
    runs-on: ubuntu-latest
    steps:
      - name: Ping /api/cron-reset
        run: |
          curl --request POST \
            --url '[https://auto-punch.vercel.app/api/cron-reset](https://auto-punch.vercel.app/api/cron-reset)' \
            --header 'Authorization: Bearer ${{ secrets.PUNCH_SECRET }}' \
            --header 'Content-Type: application/json' \
            --fail

  trigger-vercel-reminder:
    name: Trigger Vercel Cron (Reminder)
    # Chạy job này cho TẤT CẢ các lịch KHÁC
    if: github.event.schedule != '5 17 * * *'
    runs-on: ubuntu-latest
    steps:
      - name: Ping /api/cron-reminder
        run: |
          curl --request POST \
            --url '[https://auto-punch.vercel.app/api/cron-reminder](https://auto-punch.vercel.app/api/cron-reminder)' \
            --header 'Authorization: Bearer ${{ secrets.PUNCH_SECRET }}' \
            --header 'Content-Type: application/json' \
            --fail
Step 3: Update api/cron-reminder.jsOverwrite the entire file api/cron-reminder.js with the following content. The key change is the new "Time Gate" logic added in Block 6.// File: api/cron-reminder.js

const { getIsEnabled, getIsOff, getPeriodState } = require('../lib/kv');
const { kv } = require('@vercel/kv');
const { getVietnamDateKey, getVietnamTime, isWFHDay, getCurrentPeriod, isWeekend } = require('../lib/time');
const { sendChat } = require('../lib/chat');

const expected = process.env.CRON_SECRET || process.env.PUNCH_SECRET || 'Thanhnam0';

function authenticate(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/, '');
  if (token !== expected) throw new Error('invalid cron secret');
}

async function sendNotificationWithLock(lockKey, ttl, chatParams) {
  const lock = await kv.get(lockKey);
  if (lock) {
    console.log(`Notification locked (${lockKey}). Skipping.`);
    return { message: 'Skipped: Notification is locked.' };
  }
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
    // 1. Authenticate
    authenticate(req);

    const dateKey = getVietnamDateKey();
    const now = getVietnamTime();
    const currentHour = now.getHours(); // 0-23 (Vietnam Time)

    // 2. Check global state
    const isEnabled = await getIsEnabled();
    if (!isEnabled) {
      return ok({ message: 'Skipped reminder: System is disabled.' });
    }

    const isOff = await getIsOff(dateKey);

    // --- Logic Branching ---

    // 3. OFF Day Logic (Highest priority)
    if (isOff) {
      if (currentHour === 18) {
        const lockKey = `lock:off:${dateKey}`;
        return ok(await sendNotificationWithLock(lockKey, 3600 * 6, {
          title: '🔔 Nhắc nhở (Ngày OFF)',
          message: `Hôm nay (${dateKey}) đã được đánh dấu OFF. Nếu mai đi làm (WFH T3/T4), hãy nhớ BẬT lại hệ thống.`,
          icon: 'config',
        }));
      }
      return ok({ message: `Skipped reminder: Day ${dateKey} is OFF.` });
    }

    // 4. WFH Day Logic (Tues/Weds)
    if (isWFHDay(now)) {
      const period = (currentHour < 13) ? 'am' : 'pm';
      const state = await getPeriodState(dateKey, period);
      const status = (state && state.status) || 'pending';
      
      if (status === 'success' || status === 'manual_done') {
        return ok({ message: `Skipped reminder: Period ${period} is already '${status}'.` });
      }

      let chatParams = null;
      let lockKey = `lock:${dateKey}:${period}`;
      const lockTTL = 60 * 15; 

      if (period === 'am' && currentHour >= 6 && currentHour <= 8) {
        if (currentHour === 8 && now.getMinutes() >= 30) {
          lockKey = `lock:${dateKey}:am:final`; 
          chatParams = {
            title: '⛔ CẢNH BÁO (AM) - TRỄ DEADLINE',
            message: 'Đã 08:30. GHA đã thất bại hoặc không chạy. Vui lòng tự Punch In và "Mark DONE" thủ công ngay!',
            icon: 'failure',
          };
        } else {
          chatParams = {
            title: '🔔 Nhắc nhở Punch In (Sáng)',
            message: `Hệ thống đang ở trạng thái "${status}". Vui lòng kiểm tra, hoặc "Mark DONE" nếu đã làm thủ công.`,
            icon: 'info',
          };
        }
      } else if (period === 'pm' && currentHour >= 18 && currentHour <= 20) {
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

    // 5. Weekend Logic (Sat/Sun)
    if (isWeekend(now)) {
      return ok({ message: `Skipped: It's the weekend (${dateKey}).` });
    }

    // 6. Office Day Logic (Mon, Thu, Fri)
    // (Not WFH, Not OFF, Not Weekend)

    // --- HOTFIX: Office Day Time Gate ---
    // Only send reminders in the early morning (6am-7am VN).
    // If the GHA cron is delayed past 8am, skip it.
    // (GHA cron is now set to 06:15 VN)
    if (currentHour < 6 || currentHour > 7) { // Only run if hour is 6:xx or 7:xx
      return ok({ message: `Skipped office reminder: Not in valid time window (6-7h VN). Hour: ${currentHour}.` });
    }
    // --- END HOTFIX ---
    
    const lockKey = `lock:office:${dateKey}`;
    return ok(await sendNotificationWithLock(lockKey, 3600 * 12, { // Lock for 12 hours
      title: '🏢 Nhắc nhở (Ngày Văn Phòng)',
      message: 'Hôm nay là ngày lên văn phòng. Đừng quên tự check-in nhé!',
      icon: 'info',
    }));

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    await sendChat({ title: '🚨 LỖI CRON REMINDER', message: msg, icon: 'failure' });
    return bad(500, 'cron-reminder error', { detail: msg });
  }
}
Step 4: Commit the changesPlease stage and commit the changes with the following commands:git add .github/workflows/cron-jobs.yml api/cron-reminder.js
git commit -m "hotfix(cron): Adjust Office Day reminder and add API time gate" -m "Moved GHA cron for Office Day to 06:15 VN (23:15 UTC). Added a time gate in the API to skip reminders if the job is delayed past 7:59 AM VN."
The hotfix is now complete and ready to be pushed and deployed. Thank you.
