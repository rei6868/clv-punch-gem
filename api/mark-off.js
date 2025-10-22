
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
    await kv.set(getKeyDayOff(dateStr), true);

    const notification = {
      rid: `mark-off-${dateStr}`,
      title: '🗓️ Đã đánh dấu OFF',
      subtitle: `Ngày: ${dateStr}`,
      status: 'info',
    };
    await sendGoogleChatNotification(notification);

    res.status(200).json({ ok: true, date: dateStr, off: true });
  } catch (error) {
    console.error('Error marking day off:', error);
    res.status(500).json({ ok: false, error: 'Failed to mark day off in KV' });
  }
}
