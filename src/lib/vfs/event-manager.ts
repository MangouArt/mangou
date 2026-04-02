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

  private pendingEvents = new Map<string, { type: 'updated' | 'deleted'; timestamp: Date }>();
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 300;

  private handleFsEvent(fullPath: string, type: 'updated' | 'deleted') {
    const parsed = parseWorkspaceFsEvent(this.resolveWorkspaceRoot(), fullPath);
    if (!parsed) return;

    const eventKey = `${parsed.projectId}::${parsed.path}`;
    this.pendingEvents.set(eventKey, { type, timestamp: new Date() });

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flushEvents(), this.DEBOUNCE_MS);
  }

  private flushEvents() {
    this.debounceTimer = null;
    const logger = process.env.MANGOU_STDIO_MODE === 'true' ? console.error : console.log;
    
    if (this.pendingEvents.size > 0) {
      logger(`[VFSEventManager] Flushing ${this.pendingEvents.size} debounced events...`);
      this.pendingEvents.forEach((event, key) => {
        const [projectId, path] = key.split('::');
        this.emit('change', { projectId, path, ...event });
      });
      this.pendingEvents.clear();
    }
  }

  notifyFileChanged(projectId: string, path: string, type: 'updated' | 'deleted') {
    this.handleFsEvent(path, type); // Use the debounced handler
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
