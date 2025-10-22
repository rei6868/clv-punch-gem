// File: lib/chat.js

const axios = require('axios');
const { getVietnamTimestamp } = require('./time');

const { GOOGLE_CHAT_WEBHOOK_URL } = process.env;

// (SỬA LỖI ẢNH) Dùng link icon ổn định
const ICONS = {
  success: 'https://raw.githubusercontent.com/google-gemini/cookbook/main/Ecosystems/GCP/Google-Chat-Vertex-AI/assets/check_circle.png',
  failure: 'https://raw.githubusercontent.com/google-gemini/cookbook/main/Ecosystems/GCP/Google-Chat-Vertex-AI/assets/warning.png',
  info: 'https://i.imgur.com/qS5tW0C.png', // Office icon
  config: 'https://i.imgur.com/A53t3zP.png', // Warning icon
  manual: 'https://i.imgur.com/gDMALbT.png', // User icon
};

/**
 * Gửi thông báo Google Chat (phiên bản linh hoạt)
 * @param {Object} params
 * @param {string} params.title - Tiêu đề chính của Card
 * @param {string} [params.subtitle] - Tiêu đề phụ (mặc định là giờ VN)
 * @param {string} [params.message] - Nội dung text (nếu có)
 * @param {string} [params.imageUrl] - Link ảnh (nếu có)
 * @param {'success' | 'failure' | 'info' | 'config' | 'manual'} params.icon - Loại icon
 */
async function sendChat(params) {
  if (!GOOGLE_CHAT_WEBHOOK_URL) {
    console.warn('Google Chat Webhook URL is not defined. Skipping notification.');
    return;
  }

  const {
    title,
    subtitle = getVietnamTimestamp(),
    message = '',
    imageUrl = '',
    icon = 'info',
  } = params;

  const summaryText = title; // (SỬA LỖI "Sent attachment") Thêm text tóm tắt
  const sections = [];

  // 1. Thêm message (nếu có)
  if (message) {
    sections.push({
      widgets: [
        {
          textParagraph: {
            text: message,
          },
        },
      ],
    });
  }

  // 2. Thêm ảnh (nếu có)
  if (imageUrl) {
    sections.push({
      widgets: [
        {
          image: { imageUrl },
        },
      ],
    });
  }

  const payload = {
    text: summaryText,
    cardsV2: [
      {
        cardId: `card-${Date.now()}`,
        card: {
          header: {
            title: title,
            subtitle: subtitle,
            imageUrl: ICONS[icon] || ICONS.info,
            imageType: 'CIRCLE',
          },
          sections: sections.length > 0 ? sections : undefined,
        },
      },
    ],
  };

  try {
    await axios.post(GOOGLE_CHAT_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('Google Chat notification sent successfully.');
  } catch (error) {
    console.error('Failed to send Google Chat notification:', error.message);
  }
}

module.exports = { sendChat };