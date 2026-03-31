/**
 * Single Source of Truth for AIGC related constants
 */

export const TASK_STATUS = {
  NOT_START: 'NOT_START',
  SUBMITTED: 'SUBMITTED',
  QUEUED: 'QUEUED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

export const MODELS = {
  IMAGE: {
    DEFAULT: 'nano-banana',
    NANO_BANANA: 'nano-banana',
    NANO_BANANA_2: 'nano-banana-2',
    FLUX_PRO: 'flux-1.1-pro',
    SEED_EDIT: 'nano-banana',
  },
  CHAT: {
    DEFAULT: 'kimi-k2.5',
    FAST: 'kimi-k2.5',
  },
  VIDEO: {
    DEFAULT: 'veo3.1-fast',
    LUMA: 'veo3.1-fast',
    KLING: 'veo3.1-fast',
  }
} as const;

export const PROVIDERS = {
  BLTAI: 'bltai',
} as const;
