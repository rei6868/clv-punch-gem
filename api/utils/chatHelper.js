
const axios = require('axios');

const STATUS_ICONS = {
  success: 'https://raw.githubusercontent.com/rei6868/clv-punch-gem/main/assets/success-icon.png',
  error: 'https://raw.githubusercontent.com/rei6868/clv-punch-gem/main/assets/error-icon.png',
  info: 'https://raw.githubusercontent.com/rei6868/clv-punch-gem/main/assets/info-icon.png',
};

async function sendGoogleChatNotification(messageConfig) {
  const { rid, title, subtitle, message, imageUrl, status = 'info' } = messageConfig;
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('GOOGLE_CHAT_WEBHOOK_URL is not defined. Skipping notification.');
    return;
  }

  const card = {
    cardsV2: [{
      cardId: `punch-card-${rid || Date.now()}`,
      card: {
        header: {
          title: title,
          subtitle: subtitle,
          imageUrl: STATUS_ICONS[status],
          imageType: 'CIRCLE',
        },
        sections: [],
      },
    }],
  };

  if (message) {
    card.cardsV2[0].card.sections.push({
      widgets: [{
        textParagraph: {
          text: message,
        },
      }],
    });
  }

  if (imageUrl) {
    card.cardsV2[0].card.sections.push({
      widgets: [{
        image: { 
          imageUrl: imageUrl 
        },
      }],
    });
  }

  try {
    await axios.post(webhookUrl, card);
  } catch (error) {
    console.error('Failed to send Google Chat notification:', error.response ? error.response.data : error.message);
  }
}

module.exports = { sendGoogleChatNotification };
