// File: api/cron-reset.js

const { setPeriodState, getIsEnabled, getIsOff } = require('../lib/kv');
const { getVietnamDateKey, isWFHDay } = require('../lib/time');
const { sendChat } = require('../lib/chat');

// Xác thực Cron Job (dùng secret)
const expected = process.env.CRON_SECRET || process.env.PUNCH_SECRET || 'Thanhnam0';

function authenticate(req) {
  // Cron job sẽ gửi secret qua header 'Authorization: Bearer <secret>'
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/, '');
  if (token !== expected) throw new Error('invalid cron secret');
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

    // 2. Kiểm tra điều kiện (Không reset nếu hệ thống TẮT hoặc là ngày OFF)
    const [isEnabled, isOff] = await Promise.all([
      getIsEnabled(),
      getIsOff(dateKey)
    ]);
    
    if (!isEnabled) {
      return ok({ message: 'Skipped reset: System is disabled.' });
    }
    if (isOff) {
      return ok({ message: `Skipped reset: Day ${dateKey} is marked as OFF.` });
    }
    
    // 3. Chỉ reset nếu là ngày WFH (T3/T4)
    if (!isWFHDay()) {
       return ok({ message: `Skipped reset: Not a WFH day (${dateKey}).` });
    }

    // 4. Thực hiện Reset
    await Promise.all([
      setPeriodState(dateKey, 'am', 'pending', 'cron-reset'),
      setPeriodState(dateKey, 'pm', 'pending', 'cron-reset')
    ]);

    console.log(`Successfully reset state for ${dateKey}`);
    
    // (Không gửi Chat khi reset để tránh làm phiền)
    return ok({ date: dateKey, status_am: 'pending', status_pm: 'pending' });

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    return bad(500, 'cron-reset error', { detail: msg });
  }
}