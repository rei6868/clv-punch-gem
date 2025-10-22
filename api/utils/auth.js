
function checkAuth(req, res) {
  const secret = req.headers['x-secret'];
  const expectedSecret = process.env.PUNCH_SECRET || 'Thanhnam0';

  if (!secret) {
    res.status(401).json({ ok: false, error: 'Unauthorized: Missing X-Secret header' });
    return false;
  }

  if (secret !== expectedSecret) {
    res.status(403).json({ ok: false, error: 'Forbidden: Invalid X-Secret' });
    return false;
  }

  return true;
}

module.exports = { checkAuth };
