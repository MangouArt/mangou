import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * 本地视频拼接引擎 - 直接调用系统 FFmpeg
 */
export async function stitchVideosLocal(
  projectPath: string,
  videoPaths: string[],
  outputName: string = 'output.mp4'
): Promise<string> {
  const outputDir = path.join(projectPath, 'output');
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, outputName);

  // 1. 创建文件清单
  const listPath = path.join(outputDir, 'concat_list.txt');
  const listContent = videoPaths
    .map(p => `file '${path.resolve(projectPath, p)}'`)
    .join('\n');
  
  await fs.writeFile(listPath, listContent);

  // 2. 执行拼接
  try {
    const command = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy -y "${outputPath}"`;
    await execAsync(command);
    return outputPath;
  } catch (error: any) {
    console.error('[FFmpeg Stitch Error]:', error.message);
    throw new Error(`FFmpeg 拼接失败: ${error.message}`);
  } finally {
    // 清理临时清单
    await fs.unlink(listPath).catch(() => {});
  }
}
