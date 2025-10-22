// File: api/state/report.js

const { setPeriodState, getIsOff, getIsEnabled } = require('../../lib/kv');
const { sendChat } = require('../../lib/chat');
const { getVietnamDateKey, getCurrentPeriod } = require('../../lib/time');

const expected = process.env.PUNCH_SECRET || 'Thanhnam0';

// Helper xác thực
function authenticate(req) {
  const hdrSecret = req.headers['x-secret'] || '';
  if (hdrSecret !== expected) throw new Error('invalid secret');
}

export default async function handler(req, res) {
  const rid = req.headers['x-vercel-id'] || Date.now().toString();
  const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
  const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return bad(405, 'method not allowed');
  }
  
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
     return bad(415, 'unsupported content-type. Use application/json');
  }

  try {
    // 1. Xác thực
    authenticate(req);

    // 2. Lấy dữ liệu
    const { 
      status, // 'success' | 'fail'
      message = '', 
      imageUrl = '',
    } = req.body;

    if (!status || (status !== 'success' && status !== 'fail')) {
      return bad(400, 'invalid status. Must be "success" or "fail"');
    }

    const dateKey = (req.body && req.body.date) 
      ? String(req.body.date) 
      : getVietnamDateKey();
      
    const period = (req.body && req.body.period) 
      ? String(req.body.period) 
      : getCurrentPeriod();

    if (period !== 'am' && period !== 'pm') {
      return bad(400, 'invalid period. Must be "am" or "pm"');
    }
    
    // 3. Kiểm tra điều kiện (Không chạy nếu TẮT hoặc OFF)
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
      await sendChat({
        title: `✅ ${periodText} Thành Công (Auto)`,
        subtitle: `Ghi nhận lúc ${getVietnamDateKey(new Date(req.body.recordedPunchTime || undefined))} (auto-time)`, // Sử dụng thời gian từ GHA nếu có
        imageUrl: imageUrl || undefined,
        icon: 'success',
      });
    } else {
      await sendChat({
        title: `🚨 ${periodText} Thất Bại (Auto)`,
        message: `<b>Lỗi:</b> ${message || 'Không rõ nguyên nhân từ GHA.'}`,
        imageUrl: imageUrl || undefined,
        icon: 'failure',
      });
    }

    // 6. Trả về kết quả
    return ok({ date: dateKey, period, status });

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    if (msg.includes('method not allowed')) return bad(405, msg);
    if (msg.includes('unsupported')) return bad(415, msg);
    return bad(500, 'server error', { detail: msg });
  }
}