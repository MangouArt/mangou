import { EventEmitter } from 'events';
import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { configStore } from '../config-store';

export function parseWorkspaceFsEvent(workspaceRoot: string, fullPath: string): { projectId: string; path: string } | null {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const resolvedFullPath = path.resolve(fullPath);
  const relativePath = path.relative(resolvedWorkspaceRoot, resolvedFullPath);

  if (!relativePath || relativePath.startsWith('..')) {
    return null;
  }

  const parts = relativePath.split(path.sep).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  return {
    projectId: parts[0],
    path: `/${parts.slice(1).join('/')}`,
  };
}

class VFSEventManager extends EventEmitter {
  private watcher: FSWatcher | null = null;

  constructor() {
    super();
    this.setMaxListeners(100);
    this.initWatcher();
  }

  private resolveWorkspaceRoot(): string {
    const explicitWorkspaceRoot = process.env.MANGOU_WORKSPACE_ROOT;
    if (explicitWorkspaceRoot && explicitWorkspaceRoot.trim()) {
      return path.resolve(explicitWorkspaceRoot.trim());
    }

    const appRoot = process.env.MANGOU_HOME && process.env.MANGOU_HOME.trim()
      ? path.resolve(process.env.MANGOU_HOME.trim())
      : process.cwd();
    return path.resolve(appRoot, configStore.get('workspaceDir'));
  }

  private initWatcher() {
    const fullPath = this.resolveWorkspaceRoot();
    const logger = process.env.MANGOU_STDIO_MODE === 'true' ? console.error : console.log;
    logger(`[VFSEventManager] Watching workspace: ${fullPath}`);

    this.watcher = chokidar.watch(fullPath, {
      ignored: /(^|[\/\\])\../, // 忽略隐藏文件（如 .git, .agent_logs 等）
      persistent: true,
      ignoreInitial: true,
      depth: 3, // 只监听项目层级
    });

    this.watcher
      .on('add', (filePath: string) => this.handleFsEvent(filePath, 'updated'))
      .on('change', (filePath: string) => this.handleFsEvent(filePath, 'updated'))
      .on('unlink', (filePath: string) => this.handleFsEvent(filePath, 'deleted'));
  }

  private handleFsEvent(fullPath: string, type: 'updated' | 'deleted') {
    const parsed = parseWorkspaceFsEvent(this.resolveWorkspaceRoot(), fullPath);
    if (!parsed) return;

    const logger = process.env.MANGOU_STDIO_MODE === 'true' ? console.error : console.log;
    logger(`[VFSEventManager] FS Event: ${parsed.projectId} ${parsed.path} (${type})`);
    this.notifyFileChanged(parsed.projectId, parsed.path, type);
  }

  notifyFileChanged(projectId: string, path: string, type: 'updated' | 'deleted') {
    this.emit('change', { projectId, path, type, timestamp: new Date() });
  }

  destroy() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}

const globalForVFS = global as unknown as { vfsEventManager: VFSEventManager };
export const vfsEventManager = globalForVFS.vfsEventManager || new VFSEventManager();

if (process.env.NODE_ENV !== 'production') {
  globalForVFS.vfsEventManager = vfsEventManager;
}
