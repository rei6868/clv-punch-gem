const { kv, getKeyConfig } = require('./utils/kv');
const { checkAuth } = require('./utils/auth');
const { sendGoogleChatNotification } = require('./utils/chatHelper');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!checkAuth(req, res)) {
    return; // Auth failed, response already sent
  }

  const { isEnabled } = req.body;

  if (typeof isEnabled !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'Invalid body: isEnabled must be a boolean' });
  }

  try {
    await kv.set(getKeyConfig(), isEnabled);

    const notification = {
      rid: `config-update-${Date.now()}`,
      title: isEnabled ? '✅ Hệ thống BẬT' : '⛔️ Hệ thống TẮT',
      subtitle: `Trạng thái mới: ${isEnabled ? 'Hoạt động' : 'Tạm dừng'}`,
      status: isEnabled ? 'success' : 'error',
    };
    await sendGoogleChatNotification(notification);

    res.status(200).json({ ok: true, isEnabled });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ ok: false, error: 'Failed to update config in KV' });
  }
}