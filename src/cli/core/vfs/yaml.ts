/**
 * YAML 文件解析和序列化工具
 * 
 * 核心原则：
 * 1. 使用 js-yaml 进行解析和序列化。
 * 2. 使用 src/lib/vfs/schema.ts 中的 Zod Schema 进行结构验证。
 * 3. 统一使用嵌套结构 (meta/content/tasks/refs)。
 */

import yaml from 'js-yaml';
import { getSchemaForPath } from './schema';

// YAML 配置
const DUMP_OPTIONS = {
  indent: 2,
  lineWidth: -1,   // 不限制行宽
  noRefs: true,    // 不输出引用标记
  sortKeys: false, // 保持原始键顺序
} satisfies import('js-yaml').DumpOptions;

/**
 * 解析 YAML 内容
 */
export function parseYAML(content: string): any {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('YAML 内容为空或无效');
  }
  
  try {
    const result = yaml.load(content, { json: true });
    if (result === undefined || result === null) {
      throw new Error('YAML 解析结果为空');
    }
    return result;
  } catch (error) {
    console.error('[YAML Parse Error]:', error);
    throw new Error(`YAML 解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 安静解析（用于导出/索引，不阻断流程）
 */
export function parseYAMLQuiet(content: string): any | null {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return null;
  }
  try {
    const result = yaml.load(content, { json: true });
    if (result === undefined || result === null) return null;
    return result;
  } catch {
    return null;
  }
}

/**
 * 序列化为 YAML
 */
export function stringifyYAML(data: any): string {
  try {
    return yaml.dump(data, DUMP_OPTIONS);
  } catch (error) {
    console.error('[YAML Stringify Error]:', error);
    throw new Error(`YAML 序列化失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 验证 YAML 对象是否符合 VFS 标准结构
 * 根据文件路径使用对应的 Zod Schema
 */
export function validateYAMLFile(data: any, path: string): boolean {
  if (!data || typeof data !== 'object') return false;

  const schema = getSchemaForPath(path);
  if (!schema) {
    // 对于没有特定 Schema 的文件（如 script.yaml），执行基础结构检查
    return !!(data.meta && data.content);
  }

  const result = schema.safeParse(data);
  return result.success;
}

/**
 * 获取 YAML 验证的详细错误信息
 */
export function getYAMLValidationError(data: any, path: string): string | null {
  if (!data || typeof data !== 'object') return '数据必须是对象';

  const schema = getSchemaForPath(path);
  if (!schema) {
    if (!data.meta) return '缺少 meta 字段';
    if (!data.content) return '缺少 content 字段';
    return null;
  }

  const result = schema.safeParse(data);
  if (result.success) return null;

  // 格式化 Zod 错误信息
  return result.error.issues
    .map((err: any) => {
      const field = err.path.join('.');
      return `[${field}] ${err.message}`;
    })
    .join('\n');
}

/**
 * 格式化 YAML 错误信息供用户/Agent阅读
 */
export function formatYAMLError(error: any): string {
  if (error instanceof yaml.YAMLException) {
    return `YAML 语法错误 (行 ${error.mark?.line || '?'}): ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

