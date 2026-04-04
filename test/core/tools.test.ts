import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createToolContext, 
  initializeProjectStructure 
} from '../../src/cli/core/vfs/tools';
import { exportToExistingData } from '../../src/cli/server/ui-adapter';
import { getVFS, clearVFS } from '../../src/cli/core/vfs/core';

describe('exportToExistingData', () => {
  const projectId = 'demo';
  let context: any;

  beforeEach(() => {
    clearVFS(projectId);
    context = createToolContext(projectId);
    // initializeProjectStructure(context, ''); // Move into tests to avoid extra file side-effects
  });

  it('exports asset definitions from asset_defs directories for the resource panel', async () => {
    const vfs = getVFS(projectId);
    vfs.createDirectory('/asset_defs/chars');
    vfs.createDirectory('/asset_defs/scenes');
    vfs.createDirectory('/asset_defs/props');
    
    // Create some character, scene and prop files
    vfs.createFile('/asset_defs/chars/hero.yaml', `
meta:
  id: hero
  type: character
  version: "1.0"
content:
  name: 主角
  description: 矿工主角
tasks:
  image:
    latest:
      status: success
      output: ./assets/images/hero.png
`);

    vfs.createFile('/asset_defs/scenes/mine.yaml', `
meta:
  id: mine
  type: scene
  version: "1.0"
content:
  name: 矿井
  description: 昏暗矿井
`);

    vfs.createFile('/asset_defs/props/pickaxe.yaml', `
meta:
  id: pickaxe
  type: prop
  version: "1.0"
content:
  name: 矿镐
  description: 破旧矿镐
tasks:
  image:
    latest:
      status: failed
`);

    const { assets } = exportToExistingData(context);

    expect(assets).toEqual([
      {
        id: 'hero',
        project_id: projectId,
        type: 'character',
        name: '主角',
        description: '矿工主角',
        status: 'success',
        image_url: expect.stringContaining('hero.png'),
        metadata: expect.any(Object),
        version: '1.0',
        created_at: expect.any(String),
      },
      {
        id: 'mine',
        project_id: projectId,
        type: 'scene',
        name: '矿井',
        description: '昏暗矿井',
        status: 'pending',
        image_url: null,
        metadata: expect.any(Object),
        version: '1.0',
        created_at: expect.any(String),
      },
      {
        id: 'pickaxe',
        project_id: projectId,
        type: 'prop',
        name: '矿镐',
        description: '破旧矿镐',
        status: 'failed',
        image_url: null,
        metadata: expect.any(Object),
        version: '1.0',
        created_at: expect.any(String),
      }
    ]);
  });

  it('exports storyboard script content from content.story for the detail panel', async () => {
    const vfs = getVFS(projectId);
    vfs.createDirectory('/storyboards');
    
    vfs.createFile('/storyboards/scene-001.yaml', `
meta:
  id: scene-001
  version: "1.0"
content:
  sequence: 1
  title: 矿道交谈
  story: 杜休在矿道里遇到了孙姓青年。
  scene: 矿道中的两人
tasks:
  image:
    params:
      prompt: 矿道中的两人
    latest:
      status: completed
      output: ./assets/images/scene-001.png
  video:
    params:
      prompt: 镜头缓慢推进
refs:
  characters: ["assets/images/ref-1.png"]
`);

    const { storyboards } = exportToExistingData(context);

    expect(storyboards).toEqual([
      {
        id: 'scene-001',
        project_id: projectId,
        sequence_number: 1,
        title: '矿道交谈',
        description: '杜休在矿道里遇到了孙姓青年。',
        prompt: '矿道中的两人',
        image_url: expect.stringContaining('scene-001.png'),
        video_url: null,
        status: 'completed',
        asset_ids: ['assets/images/ref-1.png'],
        grid: null,
        parentId: null,
        tasks: expect.any(Object),
        metadata: expect.any(Object),
        created_at: expect.any(String),
      }
    ]);
  });
});
