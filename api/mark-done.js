
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

  const period = req.body?.period || getCurrentPeriod();
  if (period !== 'am' && period !== 'pm') {
    return res.status(400).json({ ok: false, error: 'Invalid period. Must be \'am\' or \'pm\'' });
  }

  const dateStr = getVNDateString();
  const state = {
    status: 'manual_done',
    source: 'shortcut',
    lastUpdate: getVNDateTimeISO(),
  };

  try {
    await kv.set(getKeyDayPeriod(dateStr, period), state);

    const notification = {
      rid: `mark-done-${dateStr}-${period}`,
      title: '👌 Đã xác nhận Punch thủ công',
      subtitle: `Phiên: ${period.toUpperCase()} - Ngày: ${dateStr}`,
      status: 'success',
    };
    await sendGoogleChatNotification(notification);

    res.status(200).json({ ok: true, date: dateStr, period, state });
  } catch (error) {
    console.error('Error marking done:', error);
    res.status(500).json({ ok: false, error: 'Failed to mark done in KV' });
  }
}
