const { setIsEnabled, getIsEnabled } = require('../lib/kv');
const { sendChat } = require('../lib/chat');
const { getVietnamTimestamp } = require('../lib/time');

const expected = process.env.PUNCH_SECRET || 'Thanhnam0';

// Helper xác thực
function authenticate(req) {
  const hdrSecret = req.headers['x-secret'] || '';
  const qSecret = (req.query && req.query.secret) || '';
  const secret = hdrSecret || qSecret || '';

  if (!secret) throw new Error('missing secret');
  if (secret !== expected) throw new Error('invalid secret');
}

// Helper lấy isEnabled từ request
function getIsEnabledFromRequest(req) {
  let isEnabled;

  if (req.method === 'GET') {
    if (typeof req.query?.isEnabled !== 'undefined') {
      isEnabled = String(req.query.isEnabled).toLowerCase() === 'true';
    }
  } else if (req.method === 'POST') {
    const ctype = String(req.headers['content-type'] || '');

    if (ctype.includes('application/json')) {
      if (!req.body) throw new Error('missing JSON body');
      if (typeof req.body.isEnabled === 'undefined') {
        throw new Error('missing isEnabled in JSON body');
      }
      isEnabled = !!req.body.isEnabled;
    } else {
      // Đơn giản hóa, chỉ hỗ trợ JSON post
      throw new Error('unsupported content-type. Use application/json');
    }
  } else {
    throw new Error('method not allowed');
  }

  if (typeof isEnabled === 'undefined') {
    throw new Error('missing isEnabled parameter');
  }
  return isEnabled;
}

export default async function handler(req, res) {
  const rid = req.headers['x-vercel-id'] || Date.now().toString();
  const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
  const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

  try {
    // 1. Xác thực
    authenticate(req);

    // 2. Lấy trạng thái
    if (req.method === 'GET' && typeof req.query?.isEnabled === 'undefined') {
      // Chế độ đọc (GET không có param)
      const isEnabled = await getIsEnabled();
      return ok({ isEnabled, timestamp: getVietnamTimestamp() });
    }

    // 3. Lấy giá trị isEnabled từ request
    const isEnabled = getIsEnabledFromRequest(req);

    // 4. Lưu vào KV
    await setIsEnabled(isEnabled);

    // 5. Gửi thông báo Chat
    const title = isEnabled
      ? '🟢 Hệ thống Auto-Punch: ĐÃ BẬT'
      : '🔴 Hệ thống Auto-Punch: ĐÃ TẮT';
    const message = isEnabled
      ? 'Hệ thống sẽ tự động chạy (WFH T3/T4) và gửi nhắc nhở.'
      : 'Hệ thống đã bị TẮT. Sẽ không có tự động punch hoặc nhắc nhở nào.';
    
    await sendChat({
      title: title,
      message: message,
      icon: 'config',
    });

    // 6. Trả về kết quả
    return ok({ isEnabled });

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    if (msg.includes('method not allowed')) return bad(405, msg);
    if (msg.includes('missing') || msg.includes('unsupported')) return bad(400, msg);
    return bad(500, 'server error', { detail: msg });
  }
}