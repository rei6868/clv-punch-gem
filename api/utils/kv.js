
const { createClient } = require('@vercel/kv');

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const getKeyConfig = () => 'punch:config:isEnabled';
const getKeyDayOff = (dateStr) => `punch:day:${dateStr}:off`;
const getKeyDayPeriod = (dateStr, period) => `punch:day:${dateStr}:${period}`;
const getKeyStateVersion = () => 'punch:version';

module.exports = { 
    kv, 
    getKeyConfig, 
    getKeyDayOff, 
    getKeyDayPeriod, 
    getKeyStateVersion 
};
