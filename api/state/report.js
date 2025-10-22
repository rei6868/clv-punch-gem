// File: api/state/report.js

const { setPeriodState, getIsOff, getIsEnabled } = require('../../lib/kv');
const { sendChat } = require('../../lib/chat');
const { getVietnamDateKey, getCurrentPeriod, getVietnamTimestamp } = require('../../lib/time');

// --- SỬA LOGIC XÁC THỰC ---
const expected = process.env.CRON_SECRET || process.env.PUNCH_SECRET || 'Thanhnam0';

function authenticate(req) {
  // Cron job và GHA sẽ gửi secret qua header 'Authorization: Bearer <secret>'
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/, '');
  if (token !== expected) throw new Error('invalid secret');
}
// --- KẾT THÚC SỬA ---

export default async function handler(req, res) {
  const rid = req.headers['x-vercel-id'] || Date.now().toString();
  const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
  const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return bad(405, 'method not allowed');
  }
  
  // (Chúng ta sẽ nới lỏng content-type, GHA có thể gửi text/plain)
  // if (!String(req.headers['content-type'] || '').includes('application/json')) {
  //    return bad(415, 'unsupported content-type. Use application/json');
  // }

  try {
    // 1. Xác thực
    authenticate(req);

    // 2. Lấy dữ liệu (Phải parse body nếu GHA gửi text)
    let body = req.body;
    if (typeof req.body === 'string' && req.body.length > 0) {
      try {
        body = JSON.parse(req.body);
      } catch (e) {
        return bad(400, 'invalid JSON body');
      }
    }

    const { 
      status, // 'success' | 'fail'
      message = '', 
      imageUrl = '',
    } = body;

    if (!status || (status !== 'success' && status !== 'fail')) {
      return bad(400, 'invalid status. Must be "success" or "fail"');
    }

    const dateKey = (body && body.date) 
      ? String(body.date) 
      : getVietnamDateKey();
      
    const period = (body && body.period) 
      ? String(body.period) 
      : getCurrentPeriod();

    if (period !== 'am' && period !== 'pm') {
      return bad(400, 'invalid period. Must be "am" or "pm"');
    }
    
    // 3. Kiểm tra điều kiện
    const [isEnabled, isOff] = await Promise.all([
      getIsEnabled(),
      getIsOff(dateKey)
    ]);
    
    if (!isEnabled) {
      return ok({ message: 'Skipped: System is disabled.' });
    }
    if (isOff) {
      return ok({ message: `Skipped: Day ${dateKey} is marked as OFF.` });
    }

    // 4. Lưu vào KV
    const metadata = { message, imageUrl };
    await setPeriodState(dateKey, period, status, 'gha', metadata);

    // 5. Gửi thông báo Chat
    const periodText = period === 'am' ? 'Punch In (Sáng)' : 'Punch Out (Chiều)';
    
    if (status === 'success') {
      const recordedTime = body.recordedPunchTime ? new Date(body.recordedPunchTime) : null;
      const isValidDate = recordedTime && !isNaN(recordedTime);
      
      const subtitle = isValidDate
        ? `Ghi nhận lúc ${getVietnamDateKey(recordedTime)} (auto-time)`
        : getVietnamTimestamp();

      await sendChat({
        title: `✅ ${periodText} Thành Công (Auto)`,
        subtitle: subtitle,
        imageUrl: imageUrl || undefined,
        icon: 'success',
      });
    } else {
      await sendChat({
        title: `🚨 ${periodText} Thất Bại (Auto)`,
        message: `<b>Error:</b> ${message || 'No details from GHA.'}`,
        imageUrl: imageUrl || undefined,
        icon: 'failure',
      });
    }

    // 6. Trả về kết quả
    return ok({ date: dateKey, period, status });

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    return bad(500, 'server error', { detail: msg });
  }
}