import path from 'path';
import { fileExists } from './utils.mjs';

export async function inferContext(absoluteYamlPath, overrides = {}) {
  const normalized = path.resolve(absoluteYamlPath);

  if (overrides.projectRoot) {
    const projectRoot = path.resolve(overrides.projectRoot);
    const workspaceRoot = overrides.workspaceRoot ? path.resolve(overrides.workspaceRoot) : path.dirname(path.dirname(projectRoot));
    const projectId = path.basename(projectRoot);
    const yamlPath = path.relative(projectRoot, normalized);
    return { workspaceRoot, projectId, projectPath: projectId, projectRoot, yamlPath };
  }

  const segments = normalized.split(path.sep).filter(Boolean);
  const projectsIndex = segments.lastIndexOf('projects');

  if (projectsIndex >= 1 && segments.length > projectsIndex + 2) {
    const projectId = segments[projectsIndex + 1];
    const section = segments[projectsIndex + 2];
    if (section === 'storyboards' || section === 'asset_defs') {
      const projectsSegments = segments.slice(0, projectsIndex + 1);
      const projectsRoot = `${path.sep}${projectsSegments.join(path.sep)}`;
      const workspaceRoot = path.dirname(projectsRoot);
      const projectRoot = path.join(projectsRoot, projectId);
      const yamlSegments = segments.slice(projectsIndex + 2);
      const yamlPath = yamlSegments.join('/');
      const hasWorkspaceMarker = (
        (await fileExists(path.join(workspaceRoot, 'projects.json'))) ||
        (await fileExists(path.join(workspaceRoot, 'config.json'))) ||
        (await fileExists(path.join(workspaceRoot, '.mangou')))
      );

      if (hasWorkspaceMarker) {
        return { workspaceRoot, projectId, projectPath: projectId, projectRoot, yamlPath };
      }
    }
  }

  const portableProjectRoot = path.dirname(normalized);
  const portableProjectId = path.basename(portableProjectRoot);
  const portableYamlPath = path.basename(normalized);

  return {
    workspaceRoot: process.cwd(),
    projectId: portableProjectId,
    projectPath: portableProjectId,
    projectRoot: portableProjectRoot,
    yamlPath: portableYamlPath,
    isPortable: true,
  };
}
