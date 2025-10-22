const { getFullDayState } = require('../lib/kv');
const { getVietnamDateKey } = require('../lib/time');

const expected = process.env.PUNCH_SECRET || 'Thanhnam0';

// Helper xác thực (chỉ cần query secret cho GET)
function authenticate(req) {
  const qSecret = (req.query && req.query.secret) || '';
  if (qSecret !== expected) throw new Error('invalid secret');
}

export default async function handler(req, res) {
  const rid = req.headers['x-vercel-id'] || Date.now().toString();
  const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
  const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return bad(405, 'method not allowed');
  }

  try {
    // 1. Xác thực (an toàn hơn cho debug)
    authenticate(req);

    // 2. Lấy ngày
    // (Nếu không cung cấp date, dùng ngày VN hiện tại)
    const dateKey = (req.query.date && String(req.query.date).match(/^\d{4}-\d{2}-\d{2}$/))
      ? String(req.query.date)
      : getVietnamDateKey();
      
    // 3. Lấy state
    const state = await getFullDayState(dateKey);

    // 4. Trả về
    if (req.query.pretty) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(JSON.stringify({ ok: true, requestId: rid, ...state }, null, 2));
    }
    return ok(state);

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    return bad(500, 'server error', { detail: msg });
  }
}