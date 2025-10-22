
const { kv, getKeyDayPeriod } = require('../utils/kv');
const { checkAuth } = require('../utils/auth');
const { getVNDateString, getCurrentPeriod, getVNDateTimeISO } = require('../utils/timeHelper');
const { sendGoogleChatNotification } = require('../utils/chatHelper');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!checkAuth(req, res)) {
    return;
  }

  const { status, message, imageUrl } = req.body;
  let { period } = req.body;

  if (!period) {
    period = getCurrentPeriod();
  }

  if (!status || (status !== 'success' && status !== 'fail')) {
    return res.status(400).json({ ok: false, error: 'Invalid or missing status' });
  }

  const dateStr = getVNDateString();
  const state = {
    status,
    source: 'gha',
    message,
    imageUrl,
    lastUpdate: getVNDateTimeISO(),
  };

  try {
    await kv.set(getKeyDayPeriod(dateStr, period), state);

    const periodText = period === 'am' ? 'Sáng' : 'Chiều';
    const title = status === 'success' 
      ? `☀️ Punch In ${periodText} Thành Công` 
      : `🚨 Punch In ${periodText} Thất Bại`;

    const subtitle = status === 'success'
      ? `Ngày: ${dateStr}`
      : `Lỗi: ${message || 'Không rõ'}`;

    const notification = {
      rid: `gha-report-${dateStr}-${period}`,
      title,
      subtitle,
      message: status === 'fail' && imageUrl ? 'Ảnh chụp màn hình lỗi:' : null,
      imageUrl,
      status: status === 'success' ? 'success' : 'error',
    };
    await sendGoogleChatNotification(notification);

    res.status(200).json({ ok: true, state });
  } catch (error) {
    console.error('Error reporting state:', error);
    res.status(500).json({ ok: false, error: 'Failed to report state to KV' });
  }
}
