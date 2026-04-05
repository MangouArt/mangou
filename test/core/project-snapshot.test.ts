import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildProjectSnapshot } from '../../src/core/project-snapshot';

describe('project snapshot', () => {
  const projectRoot = path.join(process.cwd(), 'projects', 'test-snapshot');

  beforeEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(path.join(projectRoot, 'storyboards'), { recursive: true });
  });

  it('builds a full snapshot of the project structure and content', async () => {
    // Create a dummy project structure
    const sb1Path = path.join(projectRoot, 'storyboards/shot1.yaml');
    await fs.writeFile(sb1Path, 'meta: { id: shot1 }');

    const assetsDir = path.join(projectRoot, 'assets/images');
    await fs.mkdir(assetsDir, { recursive: true });
    await fs.writeFile(path.join(assetsDir, 'img.png'), 'dummy-binary');

    const snapshot = await buildProjectSnapshot('test-snapshot', projectRoot);

    expect(snapshot.projectId).toBe('test-snapshot');
    expect(snapshot.files.length).toBeGreaterThan(0);
    
    const sbFile = snapshot.files.find(f => f.path === '/storyboards/shot1.yaml');
    expect(sbFile).toBeDefined();
    expect(sbFile?.content).toContain('shot1');
  });
});
