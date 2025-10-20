const { Octokit } = require('@octokit/rest');

// Lấy thông tin từ Vercel Environment Variables
const {
  GITHUB_TOKEN,
  GITHUB_USER, // Tên user/org của repo (ví dụ: "rei6868")
  GITHUB_REPO, // Tên repo (ví dụ: "clv-punch-gem")
  API_SECRET_KEY, // Chìa khóa bí mật để gọi API này
} = process.env;

// Khởi tạo Octokit
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Hàm chính của Serverless Function
 */
module.exports = async (req, res) => {
  // 1. Chỉ cho phép phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Xác thực (Đơn giản: dùng một secret query param)
  // URL gọi sẽ là: .../api/updateConfig?secret=abc1234
  if (req.query.secret !== API_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // 3. Lấy trạng thái 'isEnabled' từ body request
  // Request body: { "isEnabled": true } hoặc { "isEnabled": false }
  const { isEnabled } = req.body;
  if (typeof isEnabled !== 'boolean') {
    return res.status(400).json({ error: 'Invalid input. "isEnabled" (boolean) is required.' });
  }

  const newConfigContent = JSON.stringify({ isAutomationEnabled: isEnabled }, null, 2);
  const commitMessage = isEnabled
    ? 'chore(system): BẬT Auto-Punch qua API'
    : 'chore(system): TẮT Auto-Punch qua API';
  
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
      return res.status(200).json({ message: 'No change needed. Config is already set.' });
    }

    // 6. Tạo/Cập nhật file trên GitHub
    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_USER,
      repo: GITHUB_REPO,
      path: 'config.json',
      message: commitMessage,
      content: newContentBase64,
      sha: currentSha, // Cung cấp SHA để cập nhật
    });

    res.status(200).json({ success: true, isEnabled: isEnabled });

  } catch (error) {
    console.error('Failed to update GitHub config file:', error);
    res.status(500).json({ error: 'Failed to update config file on GitHub.' });
  }
};
