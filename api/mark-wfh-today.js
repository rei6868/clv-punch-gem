// File: api/mark-wfh-today.js

const { Octokit } = require('@octokit/rest');
const { kv } = require('@vercel/kv');
const { sendChat } = require('../lib/chat');
const { getVietnamDateKey } = require('../lib/time');

// Xác thực (Bí mật của Shortcut)
const punchSecret = process.env.PUNCH_SECRET || 'Thanhnam0';
// Xác thực (Bí mật để gọi GHA)
const githubPat = process.env.GITHUB_PAT;

// Thông tin Repo (Cần thay đổi nếu tên repo hoặc user thay đổi)
const GHA_OWNER = 'rei6868';
const GHA_REPO = 'clv-punch-gem';
const GHA_WORKFLOW_ID = 'wfh-punch.yml';

/**
* Xác thực request từ Shortcut
*/
function authenticate(req) {
const auth = req.headers.authorization || '';
const token = auth.replace(/^Bearer\s+/, '');
if (token !== punchSecret) throw new Error('invalid punch secret');
}

/**
* Dùng Octokit và GITHUB_PAT để trigger GHA workflow_dispatch
*/
async function triggerGitHubWorkflow() {
if (!githubPat) {
throw new Error('GITHUB_PAT is not configured on Vercel.');
}

const octokit = new Octokit({ auth: githubPat });

try {
await octokit.actions.createWorkflowDispatch({
owner: GHA_OWNER,
repo: GHA_REPO,
workflow_id: GHA_WORKFLOW_ID,
ref: 'main', // (Giả sử branch chính là 'main')
});
console.log(`Successfully triggered workflow: ${GHA_WORKFLOW_ID}`);
return true;
} catch (error) {
console.error(`Failed to trigger workflow: ${error.message}`);
if (error.status === 404) {
throw new Error(`Workflow file '${GHA_WORKFLOW_ID}' not found or PAT has wrong permissions.`);
}
throw error;
}
}

/**
* Ghi cờ override vào Vercel KV
*/
async function setWfhOverride(dateKey) {
const key = `punch:day:${dateKey}:wfh_override`;
// Set cờ, tự xóa sau 24 tiếng
await kv.set(key, true, { ex: 86400 });
}

export default async function handler(req, res) {
const rid = req.headers['x-vercel-id'] || Date.now().toString();
const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

if (req.method !== 'POST') {
res.setHeader('Allow', 'POST');
return bad(405, 'method not allowed');
}

try {
// 1. Xác thực request (từ Shortcut)
authenticate(req);

const dateKey = getVietnamDateKey();

// 2. Ghi cờ override (để 18:00 còn chạy PM)
await setWfhOverride(dateKey);

// 3. Kích hoạt GHA (Punch In)
await triggerGitHubWorkflow();

// 4. Gửi thông báo xác nhận
await sendChat({
title: 'ℹ️ Đã kích hoạt WFH (Sáng)',
message: `Đã gửi lệnh kích hoạt Punch In (AM) ngay lập tức. Hệ thống cũng sẽ tự động chạy Punch Out (PM) vào khoảng 18:00.`,
icon: 'info',
});

// 5. Trả về kết quả
return ok({ triggered: true, override_set: true });

} catch (e) {
const msg = (e && e.message) || 'unknown error';
if (msg.includes('secret')) return bad(403, msg);
await sendChat({ title: '🚨 LỖI Kích hoạt WFH', message: msg, icon: 'failure' });
return bad(500, 'server error', { detail: msg });
}
}
