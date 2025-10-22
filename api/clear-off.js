
const { kv, getKeyDayOff } = require('./utils/kv');
const { checkAuth } = require('./utils/auth');
const { getVNDateString } = require('./utils/timeHelper');
const { sendGoogleChatNotification } = require('./utils/chatHelper');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!checkAuth(req, res)) {
    return;
  }

  const dateStr = req.body?.date || getVNDateString();

  try {
    await kv.del(getKeyDayOff(dateStr));

    const notification = {
      rid: `clear-off-${dateStr}`,
      title: '👍 Đã XÓA đánh dấu OFF',
      subtitle: `Ngày: ${dateStr}`,
      status: 'success',
    };
    await sendGoogleChatNotification(notification);

    res.status(200).json({ ok: true, date: dateStr, off: false });
  } catch (error) {
    console.error('Error clearing day off:', error);
    res.status(500).json({ ok: false, error: 'Failed to clear day off in KV' });
  }
}
