// File: lib/chat.js

const axios = require('axios');
const { getVietnamTimestamp } = require('./time');

const { GOOGLE_CHAT_WEBHOOK_URL } = process.env;

// Dùng icon gstatic ổn định
const ICONS = {
  success: 'https://www.gstatic.com/images/icons/material/system/2x/check_circle_green_24dp.png',
  success_am: 'https://www.gstatic.com/images/icons/material/system/2x/wb_sunny_black_24dp.png',
  success_pm: 'https://www.gstatic.com/images/icons/material/system/2x/brightness_3_black_24dp.png',
  failure: 'https://www.gstatic.com/images/icons/material/system/2x/error_red_24dp.png',
  info: 'https://www.gstatic.com/images/icons/material/system/2x/commute_black_24dp.png',
  config: 'https://www.gstatic.com/images/icons/material/system/2x/settings_black_24dp.png',
  manual: 'https://www.gstatic.com/images/icons/material/system/2x/account_circle_black_24dp.png',
};

/**
 * Gửi thông báo Google Chat (phiên bản linh hoạt)
 * @param {Object} params
 * @param {string} params.title - Tiêu đề chính của Card
 * @param {string} [params.subtitle] - Tiêu đề phụ (mặc định là giờ VN)
 * @param {string} [params.message] - Nội dung text (nếu có)
 * @param {string} [params.imageUrl] - Link ảnh (nếu có)
 * @param {'success' | 'failure' | 'info' | 'config' | 'manual'} params.icon - Loại icon
 * @param {Object} [params.linkButton] - Nút bấm (nếu có)
 * @param {string} params.linkButton.text - Chữ trên nút
 * @param {string} params.linkButton.url - Link của nút
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
    linkButton, // <-- THAM SỐ MỚI
  } = params;

  const summaryText = title; 
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
  
  // 3. THÊM NÚT BẤM (NẾU CÓ)
  if (linkButton && linkButton.text && linkButton.url) {
    sections.push({
      widgets: [
        {
          buttonList: {
            buttons: [
              {
                text: linkButton.text,
                onClick: {
                  openLink: {
                    url: linkButton.url,
                  },
                },
              },
            ],
          },
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
