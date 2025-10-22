const { setPeriodState, getPeriodState } = require('../lib/kv');
const { sendChat } = require('../lib/chat');
const { getVietnamDateKey, getCurrentPeriod } = require('../lib/time');

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
  
  // Chỉ hỗ trợ JSON
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
     return bad(415, 'unsupported content-type. Use application/json');
  }

  try {
    // 1. Xác thực
    authenticate(req);

    // 2. Lấy dữ liệu
    const dateKey = (req.body && req.body.date) 
      ? String(req.body.date) 
      : getVietnamDateKey();
      
    const period = (req.body && req.body.period) 
      ? String(req.body.period) 
      : getCurrentPeriod();

    if (period !== 'am' && period !== 'pm') {
      return bad(400, 'invalid period. Must be "am" or "pm"');
    }
    
    // 3. Kiểm tra trạng thái hiện tại (tránh ghi đè success)
    const currentState = await getPeriodState(dateKey, period);
    if (currentState && currentState.status === 'success') {
      return ok({ 
        message: 'Already in success state. No change made.', 
        state: currentState 
      });
    }

    // 4. Lưu vào KV
    const metadata = { message: 'Marked done manually via Shortcut' };
    await setPeriodState(dateKey, period, 'manual_done', 'shortcut', metadata);

    // 5. Gửi thông báo Chat
    const periodText = period === 'am' ? 'Punch In (Sáng)' : 'Punch Out (Chiều)';
    
    await sendChat({
      title: `👌 Đã xác nhận: ${periodText} (Thủ công)`,
      message: `Đã đánh dấu ${periodText} ngày ${dateKey} là ĐÃ XONG. Hệ thống sẽ ngừng nhắc nhở cho phiên này.`,
      icon: 'manual',
    });

    // 6. Trả về kết quả
    return ok({ date: dateKey, period, status: 'manual_done' });

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    if (msg.includes('method not allowed')) return bad(405, msg);
    if (msg.includes('unsupported')) return bad(415, msg);
    return bad(500, 'server error', { detail: msg });
  }
}