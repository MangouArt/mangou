import { describe, expect, it } from 'vitest';
import path from 'path';
import { parseWorkspaceFsEvent } from '../../src/cli/core/vfs/event-manager';

describe('parseWorkspaceFsEvent', () => {
  it('把 projects/<projectId> 下的文件事件解析成 projectId + vfsPath', () => {
    const workspaceRoot = '/tmp/mangou-workspace/projects';
    const fullPath = path.join(workspaceRoot, 'demo', 'storyboards', 'scene-001.yaml');

    expect(parseWorkspaceFsEvent(workspaceRoot, fullPath)).toEqual({
      projectId: 'demo',
      path: '/storyboards/scene-001.yaml',
    });
  });

  it('忽略不在项目目录下的文件事件', () => {
    const workspaceRoot = '/tmp/mangou-workspace/projects';
    const fullPath = path.join('/tmp/mangou-workspace', 'projects.json');

    expect(parseWorkspaceFsEvent(workspaceRoot, fullPath)).toBeNull();
  });
});
