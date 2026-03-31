import { TaskStatus } from './constants';

export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface Message {
  role: Role;
  content?: string | MessageContent[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ImageGenerationOptions {
  prompt: string;
  model: string;
  negative_prompt?: string;
  aspect_ratio?: '4:3' | '3:4' | '16:9' | '9:16' | '2:3' | '3:2' | '1:1' | '4:5' | '5:4' | '21:9';
  image_size?: '1K' | '2K' | '4K';
  image?: string[]; // Reference images (URLs or base64)
  response_format?: 'url' | 'b64_json';
  n?: number;
  [key: string]: any; // Allow for provider-specific options
}

export interface ImageEditOptions {
  image_url: string;
  prompt: string;
  model?: string;
}

export interface AIGCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ImageGenerationResult {
  urls: string[];
}

export interface ImageTaskResponse {
  task_id: string;
}

export interface ImageTaskResult {
  task_id: string;
  status: TaskStatus;
  fail_reason?: string;
  data?: {
    output?: string;
    outputs?: string[];
    [key: string]: any;
  };
}

// Video Generation Types
export interface VideoGenerationOptions {
  prompt: string;
  model: string;
  image_url?: string;
  images?: string[];
  enhance_prompt?: boolean;
  negative_prompt?: string;
  duration?: number;
  aspect_ratio?: string;
  size?: string;
  resolution?: string;
  videos?: string[];
  watermark?: boolean;
}

export interface VideoTaskResponse {
  task_id: string;
}

export interface VideoTaskResult {
  task_id: string;
  status: TaskStatus;
  fail_reason?: string;
  submit_time?: number;
  start_time?: number;
  finish_time?: number;
  progress?: string;
  data?: {
    output?: string;
    outputs?: string[];
    [key: string]: any;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatOptions {
  model: string;
  messages: Message[];
  json_mode?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface ChatResult {
  content: string;
  tool_calls?: ToolCall[];
}

export interface AIGCProvider {
  name: string;
  // Chat Completion
  chat(options: ChatOptions): Promise<AIGCResponse<ChatResult>>;

  // Synchronous Image Generation (Chat-completion based)
  generateImage(options: ImageGenerationOptions): Promise<AIGCResponse<ImageGenerationResult>>;
  
  // Asynchronous Image Generation
  submitImageGeneration(options: ImageGenerationOptions): Promise<AIGCResponse<ImageTaskResponse>>;
  getImageTask(taskId: string): Promise<AIGCResponse<ImageTaskResult>>;

  // Image Editing (SeedEdit)
  editImage(options: ImageEditOptions): Promise<AIGCResponse<ImageGenerationResult>>;

  // Video Generation Methods
  generateVideo(options: VideoGenerationOptions): Promise<AIGCResponse<VideoTaskResponse>>;
  getVideoTask(taskId: string): Promise<AIGCResponse<VideoTaskResult>>;
}
