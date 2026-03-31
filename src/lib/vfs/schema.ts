import { z } from 'zod';

/**
 * VFS 统一 Schema 定义
 * 
 * 核心原则：
 * 1. YAML 是唯一真相源。
 * 2. 严格遵循嵌套结构：meta, content, tasks。
 * 3. AIGC 参数使用 snake_case (对接 API)，业务字段使用 camelCase (内部逻辑)。
 */

// --- 基础子 Schema ---

// 统一日期 Schema：支持字符串 (ISO) 或 Date 对象，并自动转换为 ISO 字符串
const DateTimeSchema = z.union([
  z.string().datetime(),
  z.date()
]).transform(val => (val instanceof Date ? val.toISOString() : val));

// 元数据
export const MetaSchema = z.object({
  id: z.string().describe('唯一标识符'),
  type: z.string().describe('资源类型'),
});

// AIGC 任务状态
export const TaskLatestSchema = z.object({
  status: z.enum(['pending', 'processing', 'success', 'failed', 'cancelled']).default('pending'),
  output: z.object({
    files: z.array(z.string()).default([]),
  }).optional(),
  error: z.string().nullable().optional(),
  task_id: z.string().nullable().optional(),
  upstream_task_id: z.string().nullable().optional(),
  updated_at: DateTimeSchema.optional(),
});

// 图片生成参数
export const ImageParamsSchema = z.object({
  prompt: z.string().min(1, '提示词不能为空'),
  model: z.string().optional(),
  aspect_ratio: z.enum(['4:3', '3:4', '16:9', '9:16', '2:3', '3:2', '1:1', '4:5', '5:4', '21:9']).optional(),
  image_size: z.enum(['1K', '2K', '4K']).optional(),
  negative_prompt: z.string().optional(),
  n: z.number().int().positive().default(1),
}).passthrough();

// 视频生成参数
export const VideoParamsSchema = z.object({
  prompt: z.string().min(1, '提示词不能为空'),
  model: z.string().optional(),
  aspect_ratio: z.enum(['16:9', '9:16', '1:1', '4:3', '3:4']).optional(),
  duration: z.number().default(4),
}).passthrough();

// 任务集合
export const TasksSchema = z.object({
  image: z.object({
    params: ImageParamsSchema,
    latest: TaskLatestSchema.optional(),
  }).optional(),
  video: z.object({
    params: VideoParamsSchema,
    latest: TaskLatestSchema.optional(),
  }).optional(),
}).passthrough();

// --- 实体 Schema ---

/**
 * 分镜 (Storyboard) Schema
 * 路径: /storyboards/*.yaml
 */
export const StoryboardSchema = z.object({
  meta: MetaSchema.extend({
    version: z.string().default('1.0'),
  }),
  content: z.object({
    sequence: z.number().int().describe('分镜序号'),
    title: z.string().describe('标题'),
    story: z.string().describe('剧情说明'),
    action: z.string().describe('动作描述'),
    scene: z.string().describe('场景描述'),
    duration: z.string().describe('时长 (如 4s)'),
    characters: z.array(z.string()).default([]),
    image_url: z.string().optional(),
  }),
  tasks: TasksSchema.optional(),
  refs: z.record(z.string(), z.any()).default({}),
});

/**
 * 资产 (Asset: Character, Scene, Prop) Schema
 * 路径: /characters/*.yaml, /scenes/*.yaml
 */
export const AssetSchema = z.object({
  meta: MetaSchema.extend({
    version: z.string().default('1.0'),
  }),
  content: z.object({
    name: z.string().describe('名称'),
    name_en: z.string().optional(),
    description: z.string().describe('描述'),
    appearance: z.string().optional(),
    setting: z.string().optional(),
    atmosphere: z.string().optional(),
    era: z.string().optional(),
    tags: z.array(z.string()).default([]),
    reference_images: z.array(z.string()).default([]),
  }),
  tasks: TasksSchema.optional(),
  refs: z.record(z.string(), z.any()).default({}),
});

/**
 * 项目配置 (Project) Schema
 * 路径: /mango.yaml
 */
export const ProjectSchema = z.object({
  meta: MetaSchema,
  content: z.object({
    name: z.string(),
    status: z.enum(['planning', 'storyboarding', 'generating', 'completed']).default('planning'),
    config: z.record(z.string(), z.any()).optional(),
  }),
});

// --- 类型导出 ---
export type StoryboardData = z.infer<typeof StoryboardSchema>;
export type AssetData = z.infer<typeof AssetSchema>;
export type ProjectData = z.infer<typeof ProjectSchema>;
export type TaskLatest = z.infer<typeof TaskLatestSchema>;

/**
 * 校验函数映射
 */
export const SCHEMAS = {
  storyboard: StoryboardSchema,
  asset: AssetSchema,
  project: ProjectSchema,
};

/**
 * 根据路径获取对应的 Schema
 */
export function getSchemaForPath(path: string) {
  if (path.startsWith('/storyboards/')) return StoryboardSchema;
  if (path.startsWith('/characters/')) return AssetSchema;
  if (path.startsWith('/scenes/')) return AssetSchema;
  if (path.startsWith('/props/')) return AssetSchema;
  if (path === '/mango.yaml') return ProjectSchema;
  return null;
}

/**
 * 为 Agent 生成格式说明文档
 */
export function generateSchemaPrompt(): string {
  return `所有 YAML 文件必须遵循以下严格的嵌套结构：

1. 分镜文件 (/storyboards/*.yaml):
\`\`\`yaml
meta:
  id: scene-1
  type: storyboard
content:
  sequence: 1
  script: "原剧本片段"
  refs: ["asset-id-1", "asset-id-2"] # 资产 ID，不区分类别
tasks: # 可选，用于 AIGC 任务
  image:
    params:
      prompt: "图片生成提示词"
      aspect_ratio: "16:9" # 可选
  video:
    params:
      prompt: "视频生成提示词"
\`\`\`

2. 资产文件 (/characters/*.yaml, /scenes/*.yaml):
\`\`\`yaml
meta:
  id: char_001
  type: character
content:
  name: "名称"
  description: "描述"
tasks:
  image:
    params:
      prompt: "外观描述提示词"
\`\`\`

重要原则：
- 严禁扁平化结构。所有业务字段必须在 content 下。
- 任务参数必须在 tasks.[type].params 下。
- 状态信息由系统维护，Agent 仅需关注 params。`;
}
