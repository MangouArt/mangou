/**
 * AIGC 模型配置中心
 * 
 * 所有支持的模型和参数都在这里定义
 * 不要在代码其他地方硬编码模型名称
 */

// 图片生成模型
export const IMAGE_MODELS = {
  NANO_BANANA: {
    id: 'nano-banana',
    name: 'Nano Banana',
    description: '默认图片生成模型',
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    defaultAspectRatio: '1:1',
  },
  NANO_BANANA_2: {
    id: 'nano-banana-2',
    name: 'Nano Banana V2',
    description: '改进版图片生成模型',
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    defaultAspectRatio: '1:1',
  },
} as const;

// 视频生成模型
export const VIDEO_MODELS = {
  VEO3_1_FAST: {
    id: 'veo3.1-fast',
    name: 'Veo 3.1 Fast',
    description: 'Google Veo 3.1 快速版（当前唯一支持的模型）',
    supportedDurations: [4, 8, 10],
    defaultDuration: 4,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultAspectRatio: '16:9',
  },
} as const;

// 默认模型
export const DEFAULT_MODELS = {
  IMAGE: IMAGE_MODELS.NANO_BANANA.id,
  VIDEO: VIDEO_MODELS.VEO3_1_FAST.id,
} as const;

// 模型选项列表（用于下拉选择）
export const MODEL_OPTIONS = {
  IMAGE: Object.values(IMAGE_MODELS).map(m => ({
    value: m.id,
    label: m.name,
  })),
  VIDEO: Object.values(VIDEO_MODELS).map(m => ({
    value: m.id,
    label: m.name,
  })),
} as const;

// 比例选项
export const ASPECT_RATIO_OPTIONS = [
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '16:9', label: '16:9 (横屏)' },
  { value: '9:16', label: '9:16 (竖屏)' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
] as const;

// 视频时长选项
export const VIDEO_DURATION_OPTIONS = [
  { value: 4, label: '4秒' },
  { value: 8, label: '8秒' },
  { value: 10, label: '10秒' },
] as const;

// 获取模型配置
export function getImageModelConfig(modelId: string) {
  return Object.values(IMAGE_MODELS).find(m => m.id === modelId) || IMAGE_MODELS.NANO_BANANA;
}

export function getVideoModelConfig(modelId: string) {
  return Object.values(VIDEO_MODELS).find(m => m.id === modelId) || VIDEO_MODELS.VEO3_1_FAST;
}

// 验证模型是否支持
export function isValidImageModel(modelId: string): boolean {
  return Object.values(IMAGE_MODELS).some(m => m.id === modelId);
}

export function isValidVideoModel(modelId: string): boolean {
  return Object.values(VIDEO_MODELS).some(m => m.id === modelId);
}
