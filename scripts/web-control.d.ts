import type { ChildProcess, SpawnOptions } from 'child_process';

export interface InitWorkspaceOptions {
  workspaceRoot: string;
  packageRoot?: string;
}

export interface CreateProjectOptions {
  workspaceRoot: string;
  projectId: string;
  name?: string;
  description?: string;
}

export interface SpawnResultLike {
  pid?: number;
  unref(): void;
}

export interface StartWebServerOptions {
  workspaceRoot: string;
  appRoot?: string;
  port?: number;
  spawnImpl?: (
    command: string,
    args: string[],
    options: SpawnOptions
  ) => ChildProcess | SpawnResultLike;
  waitForReady?: (url: string) => Promise<void>;
  isProcessRunningImpl?: (pid: number) => boolean;
}

export interface StopWebServerOptions {
  workspaceRoot: string;
  isProcessRunningImpl?: (pid: number) => boolean;
  killImpl?: (pid: number, signal?: NodeJS.Signals | number) => boolean;
}

export interface GetWebStatusOptions {
  workspaceRoot: string;
  isProcessRunningImpl?: (pid: number) => boolean;
}

export function resolveRuntimeDir(workspaceRoot: string): string;
export function resolveProjectsRoot(workspaceRoot: string): Promise<string>;
export function initWorkspace(options: InitWorkspaceOptions): Promise<{
  workspaceRoot: string;
  projectsRoot: string;
  runtimeDir: string;
}>;
export function createProject(options: CreateProjectOptions): Promise<{
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  projectRoot: string;
}>;
export function startWebServer(options: StartWebServerOptions): Promise<{
  status: 'running';
  pid: number;
  port: number;
  url: string;
  reused: boolean;
  workspaceRoot: string;
  logPath: string;
}>;
export function stopWebServer(options: StopWebServerOptions): Promise<{
  stopped: boolean;
  pid: number | null;
  port: number | null;
  workspaceRoot: string;
}>;
export function getWebStatus(options: GetWebStatusOptions): Promise<{
  status: 'running' | 'stopped';
  pid: number | null;
  port: number | null;
  url: string | null;
  workspaceRoot: string;
  logPath: string;
}>;
