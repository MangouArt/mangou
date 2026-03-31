import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;

console.log('🚀 [Mangou AI Studio] Initializing Studio Environment...');

/**
 * 💡 项目存储建议：
 * 本地模式默认在 mangou/workspace 下，适合工作室随身携带。
 * 如果你想更改到外部硬盘，请在安装后修改 .env.local 中的 NEXT_PUBLIC_VFS_ROOT。
 */

// 1. 创建工作区目录结构
const workspaceDirs = [
  'projects/assets',
  'projects/db',
  'projects'
];

workspaceDirs.forEach(dir => {
  const fullPath = path.join(rootDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Ready: ./${dir}`);
  }
});

// 2. 生成本地模式专属配置
const envPath = path.join(rootDir, '.env.local');
const defaultEnv = `# Mangou AI Studio - Studio Mode
# ----------------------------------------------------
# 模式：本地 (Local-First)
NEXT_PUBLIC_MANGO_MODE=local

# 存储：当前目录下的 projects/ (支持外部挂载)
NEXT_PUBLIC_VFS_ROOT=./projects

# 视频渲染依赖
FFMPEG_PATH=ffmpeg

# AI 配置 (用户通过 Web 页面填写或此处填写)
# OPENAI_API_KEY=sk-xxxx
# ----------------------------------------------------
`;

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, defaultEnv);
  console.log('✅ Created: .env.local');
}

// 3. 依赖检测 (FFmpeg)
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
  console.log('✅ FFmpeg detected (Video rendering enabled).');
} catch (e) {
  console.warn('⚠️ FFmpeg not found! Please install ffmpeg for video rendering.');
}

console.log(`
🎉 Mangou AI Studio is now ready to run!

📖 Studio Guide:
- License: FSL-1.1-Apache-2.0 (source-available, non-competing-SaaS)
- Projects: ./projects (Portable Mode)
- Setup: node mangou/setup.mjs

🚀 Start:
cd mangou && npm install && npm run dev
`);
