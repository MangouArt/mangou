export type TaskStatus =
  | 'pending'
  | 'submitted'
  | 'processing'
  | 'running'
  | 'success'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskEvent {
  schemaVersion?: number;
  id?: string;
  type: string;
  status: TaskStatus;
  provider?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown> | string;
  ref?: string;
  error?: string;
  worker?: string;
  event?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskSnapshot {
  id: string;
  type: string;
  status: TaskStatus;
  provider?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown> | string;
  ref?: string;
  error?: string;
  worker?: string;
  event?: string;
  createdAt?: string;
  updatedAt?: string;
}
