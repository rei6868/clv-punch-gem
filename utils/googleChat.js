const axios = require('axios');
require('dotenv').config();

const { GOOGLE_CHAT_WEBHOOK_URL } = process.env;

/**
 * Gửi thông báo đến Google Chat Space
 * @param {boolean} isSuccess - Trạng thái check-in (thành công/thất bại)
 * @param {string} imageUrl - URL ảnh chụp màn hình từ Cloudinary
 * @param {string} errorMessage - Tin nhắn lỗi (nếu có)
 * @param {string} recordedPunchTime - Thời gian đọc từ UI (ví dụ: "06:31")
 */
async function sendGoogleChatNotification(isSuccess, imageUrl, errorMessage = '', recordedPunchTime = '') {
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

  // Tùy chỉnh Title và Subtitle
  const successTitle = recordedPunchTime
    ? `${punchEmoji} ${punchType} Thành Công (lúc ${recordedPunchTime})`
    : `${punchEmoji} ${punchType} Thành Công`;
  
  const timeSubtitle = recordedPunchTime
    ? `(Giờ hệ thống: ${timeVN} - ${dateVN})`
    : `Vào lúc ${timeVN} - ${dateVN}`;

  // (SỬA LỖI ẢNH) Dùng link icon ổn định
  const successIcon = "https://raw.githubusercontent.com/google-gemini/cookbook/main/Ecosystems/GCP/Google-Chat-Vertex-AI/assets/check_circle.png";
  const failureIcon = "https://raw.githubusercontent.com/google-gemini/cookbook/main/Ecosystems/GCP/Google-Chat-Vertex-AI/assets/warning.png";
  const placeholderImage = "https://raw.githubusercontent.com/google-gemini/cookbook/main/Ecosystems/GCP/Google-Chat-Vertex-AI/assets/screenshot-placeholder.png";

  // (SỬA LỖI "Sent attachment") Thêm text tóm tắt
  const summaryText = isSuccess
    ? successTitle
    : `🚨 ${punchType} Thất Bại`;

  const successCard = {
    "text": summaryText, // Thêm text tóm tắt
    "cardsV2": [
      {
        "cardId": "punch-card",
        "card": {
          "header": {
            "title": successTitle,
            "subtitle": timeSubtitle,
            "imageUrl": successIcon, // Sửa link ảnh
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
    "text": summaryText, // Thêm text tóm tắt
    "cardsV2": [
      {
        "cardId": "punch-card-error",
        "card": {
          "header": {
            "title": `🚨 ${punchType} Thất Bại`,
            "subtitle": `Vào lúc ${timeVN} - ${dateVN}`,
            "imageUrl": failureIcon, // Sửa link ảnh
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
                  // Nếu screenshot bị crash, dùng placeholder
                  "image": { "imageUrl": imageUrl.includes('K6b4F0L') ? placeholderImage : imageUrl }
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

