
const { kv, getKeyConfig, getKeyDayOff, getKeyDayPeriod } = require('../utils/kv');
const { getVNDateString } = require('../utils/timeHelper');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const dateStr = req.query.date || getVNDateString();

  try {
    const [isEnabled, isOff, amState, pmState] = await Promise.all([
      kv.get(getKeyConfig()),
      kv.get(getKeyDayOff(dateStr)),
      kv.get(getKeyDayPeriod(dateStr, 'am')),
      kv.get(getKeyDayPeriod(dateStr, 'pm')),
    ]);

    const response = {
      ok: true,
      date: dateStr,
      config: {
        isEnabled: isEnabled ?? true, // Default to true if not set
      },
      day: {
        isOff: isOff ?? false,
        am: amState || { status: 'pending' },
        pm: pmState || { status: 'pending' },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching state:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch state from KV' });
  }
}
