const axios = require('axios');
require('dotenv').config();

const { GOOGLE_CHAT_WEBHOOK_URL } = process.env;

/**
 * Gửi thông báo đến Google Chat Space
 * @param {boolean} isSuccess - Trạng thái check-in (thành công/thất bại)
 * @param {string} imageUrl - URL ảnh chụp màn hình từ Cloudinary
 * @param {string} errorMessage - Tin nhắn lỗi (nếu có)
 */
async function sendGoogleChatNotification(isSuccess, imageUrl, errorMessage = '') {
  if (!GOOGLE_CHAT_WEBHOOK_URL) {
    console.warn('Google Chat Webhook URL is not defined. Skipping notification.');
    return;
  }

  const now = new Date();
  const timeVN = now.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
  const dateVN = now.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  // Xác định title và emoji dựa trên giờ
  const currentHourVN = parseInt(now.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }));
  const punchType = currentHourVN < 13 ? 'Punch In' : 'Punch Out';
  const punchEmoji = currentHourVN < 13 ? '☀️' : '🌙';

  const successCard = {
    "cardsV2": [
      {
        "cardId": "punch-card",
        "card": {
          "header": {
            "title": `${punchEmoji} ${punchType} Thành Công`,
            "subtitle": `Vào lúc ${timeVN} - ${dateVN}`,
            "imageUrl": "[https://i.imgur.com/vU5226f.png](https://i.imgur.com/vU5226f.png)",
            "imageType": "CIRCLE"
          },
          "sections": [
            {
              "widgets": [
                {
                  "image": { "imageUrl": imageUrl }
                }
              ]
            }
          ]
        }
      }
    ]
  };

  const failureCard = {
    "cardsV2": [
      {
        "cardId": "punch-card-error",
        "card": {
          "header": {
            "title": `🚨 ${punchType} Thất Bại`,
            "subtitle": `Vào lúc ${timeVN} - ${dateVN}`,
            "imageUrl": "[https://i.imgur.com/A53t3zP.png](https://i.imgur.com/A53t3zP.png)",
            "imageType": "CIRCLE"
          },
          "sections": [
            {
              "widgets": [
                {
                  "textParagraph": {
                    "text": `<b>Lỗi:</b> ${errorMessage}`
                  }
                },
                {
                  "image": { "imageUrl": imageUrl }
                }
              ]
            }
          ]
        }
      }
    ]
  };
  
  const payload = isSuccess ? successCard : failureCard;

  try {
    await axios.post(GOOGLE_CHAT_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Google Chat notification sent successfully.');
  } catch (error) {
    console.error('Failed to send Google Chat notification:', error.message);
  }
}

module.exports = { sendGoogleChatNotification };