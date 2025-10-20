const { Octokit } = require('@octokit/rest');

// Lấy thông tin từ Netlify Environment Variables
const {
  GITHUB_TOKEN,
  GITHUB_USER, // Tên user/org của repo (ví dụ: "rei6868")
  GITHUB_REPO, // Tên repo (ví dụ: "clv-punch-gem")
  API_SECRET_KEY, // Chìa khóa bí mật để gọi API này
} = process.env;

// Khởi tạo Octokit
const octokit = new Octokit({ auth: GITHUB_TOKEN });

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

  // 2. Xác thực (Đơn giản: dùng một secret query param)
  // URL gọi sẽ là: .../.netlify/functions/updateConfig?secret=abc1234
  if (event.queryStringParameters.secret !== API_SECRET_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }
  
  // 3. Lấy trạng thái 'isEnabled' từ body request
  // Netlify xử lý body dưới dạng string, cần 'JSON.parse()'
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
    // 4. Lấy SHA của file config.json hiện tại
    const { data: currentFile } = await octokit.repos.getContent({
      owner: GITHUB_USER,
      repo: GITHUB_REPO,
      path: 'config.json',
    });

    const currentContentBase64 = currentFile.content;
    const currentSha = currentFile.sha;

    // 5. Check xem nội dung có thay đổi không
    const newContentBase64 = Buffer.from(newConfigContent).toString('base64');
    if (newContentBase64 === currentContentBase64) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No change needed. Config is already set.' }),
      };
    }

    // 6. Tạo/Cập nhật file trên GitHub
    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_USER,
      repo: GITHUB_REPO,
      path: 'config.json',
      message: commitMessage,
      content: newContentBase64,
      sha: currentSha,
    });

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
