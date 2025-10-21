const { Octokit } = require('@octokit/rest');
const axios = require('axios'); // Thêm AXIOS

// Lấy thông tin từ Netlify Environment Variables
const {
  GITHUB_TOKEN,
  GITHUB_USER,
  GITHUB_REPO,
  API_SECRET_KEY,
  GOOGLE_CHAT_WEBHOOK_URL, // Thêm GOOGLE CHAT
} = process.env;

// Khởi tạo Octokit
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Hàm gửi thông báo Google Chat (chỉ báo cáo trạng thái)
 * @param {boolean} isEnabled - Trạng thái mới
 */
async function sendApiNotification(isEnabled) {
  if (!GOOGLE_CHAT_WEBHOOK_URL) {
    console.warn('Google Chat Webhook URL is not defined. Skipping API notification.');
    return;
  }

  const statusText = isEnabled ? "BẬT" : "TẮT";
  const statusEmoji = isEnabled ? "ℹ️" : "⚠️";
  const statusColor = isEnabled ? "#36a64f" : "#f2c733";
  const subtitle = isEnabled
    ? "Hệ thống Auto-Punch (WFH) đã sẵn sàng."
    : "Hệ thống Auto-Punch (WFH) sẽ không chạy.";

  const card = {
    "cardsV2": [
      {
        "cardId": "api-status-card",
        "card": {
          "header": {
            "title": `${statusEmoji} HỆ THỐNG ĐÃ ${statusText}`,
            "subtitle": subtitle,
            "imageUrl": isEnabled ? "https://i.imgur.com/vU5226f.png" : "https://i.imgur.com/A53t3zP.png",
            "imageType": "CIRCLE"
          }
        }
      }
    ]
  };

  try {
    await axios.post(GOOGLE_CHAT_WEBHOOK_URL, card, {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to send Google Chat (API) notification:', error.message);
    // Không làm crash API nếu gửi noti thất bại
  }
}

/**
 * Hàm handler chính của Netlify Function
 */
exports.handler = async (event, context) => {
  // 1. Chỉ cho phép phương thức POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // 2. Xác thực
  if (event.queryStringParameters.secret !== API_SECRET_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }
  
  // 3. Lấy trạng thái 'isEnabled' từ body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body.' }),
    };
  }

  const { isEnabled } = body;
  if (typeof isEnabled !== 'boolean') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid input. "isEnabled" (boolean) is required.' }),
    };
  }

  const newConfigContent = JSON.stringify({ isAutomationEnabled: isEnabled }, null, 2);
  const commitMessage = isEnabled
    ? 'chore(system): BẬT Auto-Punch qua API (Netlify)'
    : 'chore(system): TẮT Auto-Punch qua API (Netlify)';
  
  try {
    // 4. Lấy SHA
    const { data: currentFile } = await octokit.repos.getContent({
      owner: GITHUB_USER,
      repo: GITHUB_REPO,
      path: 'config.json',
    });
    const currentSha = currentFile.sha;
    const newContentBase64 = Buffer.from(newConfigContent).toString('base64');

    // 5. Check nếu nội dung đã giống (không cần làm gì)
    if (newContentBase64 === currentFile.content) {
      await sendApiNotification(isEnabled); // Vẫn gửi thông báo
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No change needed. Config is already set.' }),
      };
    }

    // 6. Cập nhật file
    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_USER,
      repo: GITHUB_REPO,
      path: 'config.json',
      message: commitMessage,
      content: newContentBase64,
      sha: currentSha,
    });

    // 7. GỬI THÔNG BÁO TỨC THÌ
    await sendApiNotification(isEnabled);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, isEnabled: isEnabled }),
    };

  } catch (error) {
    console.error('Failed to update GitHub config file:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update config file on GitHub.' }),
    };
  }
};
