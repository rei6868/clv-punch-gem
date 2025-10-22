
const TZ = 'Asia/Ho_Chi_Minh';

function getVNDate(date = null) {
  const d = date ? new Date(date) : new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 7)); // UTC+7 for Vietnam
}

function getVNDateString(date = null) {
  const vnDate = getVNDate(date);
  const year = vnDate.getFullYear();
  const month = String(vnDate.getMonth() + 1).padStart(2, '0');
  const day = String(vnDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentPeriod(date = null) {
  const vnDate = getVNDate(date);
  const hour = vnDate.getHours();
  return hour < 12 ? 'am' : 'pm';
}

function getVNDateTimeISO(date = null) {
    const vnDate = getVNDate(date);
    return vnDate.toISOString();
}

module.exports = { 
    getVNDate, 
    getVNDateString, 
    getCurrentPeriod,
    getVNDateTimeISO,
    TZ 
};
