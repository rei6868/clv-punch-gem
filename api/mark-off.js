const { setIsOff } = require('../lib/kv');
const { sendChat } = require('../lib/chat');
const { getVietnamDateKey, getVietnamTime } = require('../lib/time');

const expected = process.env.PUNCH_SECRET || 'Thanhnam0';

// Helper xác thực
function authenticate(req) {
  const hdrSecret = req.headers['x-secret'] || '';
  if (hdrSecret !== expected) throw new Error('invalid secret');
}

// Helper lấy ngày
function getDateKeyFromRequest(req) {
  if (req.body && req.body.date) {
    if (String(req.body.date).match(/^\d{4}-\d{2}-\d{2}$/)) {
      return String(req.body.date);
    } else {
      throw new Error('invalid date format. Use YYYY-MM-DD');
    }
  }
  
  // Nếu không có 'date', mặc định là hôm nay
  // (Logic "ngày mai nếu gọi tối" sẽ do Shortcut xử lý, API chỉ nhận ngày cụ thể)
  return getVietnamDateKey();
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
    const dateKey = getDateKeyFromRequest(req);

    // 3. Lưu vào KV
    await setIsOff(dateKey, true);

    // 4. Gửi thông báo Chat
    const todayKey = getVietnamDateKey();
    const dateText = (dateKey === todayKey) ? `hôm nay (${dateKey})` : `ngày ${dateKey}`;
    
    await sendChat({
      title: `🚫 Đã đánh dấu OFF: ${dateText}`,
      message: `Hệ thống sẽ KHÔNG chạy tự động và KHÔNG gửi nhắc nhở WFH cho ${dateText}.`,
      icon: 'config',
    });

    // 5. Trả về kết quả
    return ok({ date: dateKey, isOff: true });

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    if (msg.includes('method not allowed')) return bad(405, msg);
    if (msg.includes('unsupported')) return bad(415, msg);
    if (msg.includes('invalid date')) return bad(400, msg);
    return bad(500, 'server error', { detail: msg });
  }
}