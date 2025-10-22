const expected = process.env.PUNCH_SECRET || 'Thanhnam0';

export default async function handler(req, res) {
  const rid = req.headers['x-vercel-id'] || Date.now().toString();

  const bad = (code, msg, extra = {}) => {
    res.status(code).json({ ok: false, error: msg, requestId: rid, ...extra });
  };

  const ok = (data = {}) => {
    res.status(200).json({ ok: true, requestId: rid, ...data });
  };

  try {
    const hdrSecret = req.headers['x-secret'] || '';
    const qSecret = (req.query && req.query.secret) || '';
    const secret = hdrSecret || qSecret || '';

    if (!secret) return bad(401, 'missing secret');
    if (secret !== expected) return bad(403, 'invalid secret');

    let isEnabled;

    if (req.method === 'GET') {
      if (typeof req.query?.isEnabled !== 'undefined') {
        isEnabled = String(req.query.isEnabled).toLowerCase() === 'true';
      }
    } else if (req.method === 'POST') {
      const ctype = String(req.headers['content-type'] || '');

      if (ctype.includes('application/json')) {
        if (!req.body) return bad(400, 'missing JSON body');
        if (typeof req.body.isEnabled === 'undefined') {
          return bad(400, 'missing isEnabled', { hint: 'JSON { "isEnabled": true|false }' });
        }
        isEnabled = !!req.body.isEnabled;
      } else if (ctype.includes('application/x-www-form-urlencoded')) {
        let params;
        if (typeof req.body === 'string') {
          params = new URLSearchParams(req.body);
        } else if (req.body && typeof req.body === 'object') {
          params = new URLSearchParams();
          for (const [key, value] of Object.entries(req.body)) {
            if (Array.isArray(value)) {
              value.forEach((v) => params.append(key, v));
            } else if (typeof value !== 'undefined' && value !== null) {
              params.append(key, String(value));
            }
          }
        } else {
          params = new URLSearchParams();
        }

        if (!params.has('isEnabled')) return bad(400, 'missing isEnabled');
        isEnabled = String(params.get('isEnabled')).toLowerCase() === 'true';
      } else {
        return bad(415, 'unsupported content-type', {
          expected: 'application/json or x-www-form-urlencoded',
        });
      }
    } else {
      res.setHeader('Allow', 'GET, POST');
      return bad(405, 'method not allowed');
    }

    if (typeof isEnabled === 'undefined') {
      return bad(400, 'missing isEnabled', {
        hint: 'Provide ?isEnabled=true (GET) or JSON { "isEnabled": true } (POST)',
      });
    }

    return ok({ isEnabled });
  } catch (e) {
    return bad(500, 'server error', { detail: String((e && e.message) || e) });
  }
}
