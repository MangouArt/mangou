import fs from 'fs/promises';
import path from 'path';
import { configStore } from '@core/config-store';

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  coverUrl?: string;
  description?: string;
  videoUrl?: string;
}

export interface ProjectIndex {
  projects: ProjectMetadata[];
}

function resolveWorkspaceRoot(): string {
  const envRoot = process.env.MANGOU_HOME;
  if (envRoot && envRoot.trim()) {
    return path.resolve(envRoot.trim());
  }
  const explicitProjectsRoot = process.env.MANGOU_WORKSPACE_ROOT;
  if (explicitProjectsRoot && explicitProjectsRoot.trim()) {
    return path.dirname(path.resolve(explicitProjectsRoot.trim()));
  }
  return process.cwd();
}

function resolveProjectsRoot(workspaceRoot: string): string {
  const explicitProjectsRoot = process.env.MANGOU_WORKSPACE_ROOT;
  if (explicitProjectsRoot && explicitProjectsRoot.trim()) {
    return path.resolve(explicitProjectsRoot.trim());
  }
  return path.resolve(workspaceRoot, configStore.get('workspaceDir'));
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export class ProjectManager {
  private static defaultManager: ProjectManager | null = null;
  private readonly workspaceRoot: string;
  private readonly projectsRoot: string;
  private readonly indexPath: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot ? path.resolve(workspaceRoot) : resolveWorkspaceRoot();
    this.projectsRoot = resolveProjectsRoot(this.workspaceRoot);
    this.indexPath = path.join(this.workspaceRoot, 'projects.json');
  }

  static getDefault(): ProjectManager {
    if (!this.defaultManager) {
      this.defaultManager = new ProjectManager();
    }
    return this.defaultManager;
  }

  static async listProjects(): Promise<ProjectMetadata[]> {
    const manager = ProjectManager.getDefault();
    await manager.init();
    return manager.listProjects();
  }

  static async getProject(id: string): Promise<ProjectMetadata | null> {
    const manager = ProjectManager.getDefault();
    await manager.init();
    return manager.getProject(id);
  }

  async init(): Promise<void> {
    await fs.mkdir(this.workspaceRoot, { recursive: true });
    await fs.mkdir(this.projectsRoot, { recursive: true });
    if (!(await fileExists(this.indexPath))) {
      await this.saveIndex({ projects: [] });
    }
  }

  async listProjects(): Promise<ProjectMetadata[]> {
    const indexed = await this.readIndex();
    const scanned = await this.scanProjectsRoot();
    const scannedById = new Map(scanned.map((project) => [project.id, project]));

    const merged = indexed.projects
      .map((project) => scannedById.get(project.id) || null)
      .filter((project): project is ProjectMetadata => !!project);

    for (const project of scanned) {
      if (!merged.some((item) => item.id === project.id)) {
        merged.push(project);
      }
    }

    await this.saveIndex({ projects: merged });

    return merged.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getProject(projectId: string): Promise<ProjectMetadata | null> {
    const projects = await this.listProjects();
    return projects.find((project) => project.id === projectId) || null;
  }

  async updateProjectVideoUrl(projectId: string, videoUrl: string): Promise<ProjectMetadata | null> {
    const projects = await this.listProjects();
    const project = projects.find((item) => item.id === projectId);
    if (!project) return null;

    const now = new Date().toISOString();
    project.videoUrl = videoUrl;
    project.updatedAt = now;

    const projectJsonPath = path.join(this.projectsRoot, projectId, 'project.json');
    let projectJson: Record<string, unknown> = {};
    try {
      projectJson = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'));
    } catch {}
    await fs.writeFile(
      projectJsonPath,
      `${JSON.stringify({ ...projectJson, videoUrl, updatedAt: now }, null, 2)}\n`,
      'utf-8'
    );

    await this.saveIndex({ projects });
    return project;
  }

  private async scanProjectsRoot(): Promise<ProjectMetadata[]> {
    const entries = await fs.readdir(this.projectsRoot, { withFileTypes: true }).catch(() => []);
    const projects: ProjectMetadata[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const projectId = entry.name;
      const projectRoot = path.join(this.projectsRoot, projectId);
      const storyboardsDir = path.join(projectRoot, 'storyboards');
      const tasksPath = path.join(projectRoot, 'tasks.jsonl');
      const projectJsonPath = path.join(projectRoot, 'project.json');

      if (!(await fileExists(storyboardsDir))) continue;
      if (!(await fileExists(tasksPath))) {
        await fs.writeFile(tasksPath, '', 'utf-8');
      }

      let projectJson: Record<string, any> = {};
      try {
        projectJson = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'));
      } catch {}

      const now = new Date().toISOString();
      const metadata: ProjectMetadata = {
        id: projectId,
        name: projectJson.name || projectId,
        description: projectJson.description || '',
        coverUrl: projectJson.coverUrl,
        videoUrl: projectJson.videoUrl,
        createdAt: projectJson.createdAt || now,
        updatedAt: projectJson.updatedAt || projectJson.createdAt || now,
      };

      projects.push(metadata);
    }

    return projects;
  }

  private async readIndex(): Promise<ProjectIndex> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed?.projects) ? parsed : { projects: [] };
    } catch {
      return { projects: [] };
    }
  }

  private async saveIndex(index: ProjectIndex): Promise<void> {
    await fs.writeFile(this.indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');
  }
}
