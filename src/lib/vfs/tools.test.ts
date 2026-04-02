import { describe, expect, it } from 'vitest';

import { createToolContext, exportToExistingData, stringifyYAML } from '@/lib/vfs';

describe('exportToExistingData', () => {
  it('exports asset definitions from asset_defs directories for the resource panel', () => {
    const context = createToolContext('demo');

    context.vfs.createFile(
      '/asset_defs/chars/hero.yaml',
      stringifyYAML({
        meta: { id: 'hero', version: '1.0', type: 'character' },
        content: { name: '主角', description: '矿工主角' },
        tasks: {
          image: {
            latest: {
              status: 'success',
              output: 'assets/images/hero.png',
            },
          },
        },
        refs: {},
      })
    );

    context.vfs.createFile(
      '/asset_defs/scenes/mine.yaml',
      stringifyYAML({
        meta: { id: 'mine', version: '1.0', type: 'scene' },
        content: { name: '矿井', description: '昏暗矿井' },
        tasks: {
          image: {
            latest: {
              status: 'pending',
            },
          },
        },
        refs: {},
      })
    );

    context.vfs.createFile(
      '/asset_defs/props/pickaxe.yaml',
      stringifyYAML({
        meta: { id: 'pickaxe', version: '1.0', type: 'prop' },
        content: { name: '矿镐', description: '破旧矿镐' },
        tasks: {
          image: {
            latest: {
              status: 'failed',
            },
          },
        },
        refs: {},
      })
    );

    const { assets } = exportToExistingData(context);

    expect(assets).toEqual([
      {
        id: 'hero',
        type: 'character',
        name: '主角',
        description: '矿工主角',
        status: 'success',
        imageUrl: '/api/vfs?projectId=demo&path=.%2Fassets%2Fimages%2Fhero.png',
        filePath: '/asset_defs/chars/hero.yaml',
      },
      {
        id: 'mine',
        type: 'scene',
        name: '矿井',
        description: '昏暗矿井',
        status: 'pending',
        imageUrl: undefined,
        filePath: '/asset_defs/scenes/mine.yaml',
      },
      {
        id: 'pickaxe',
        type: 'prop',
        name: '矿镐',
        description: '破旧矿镐',
        status: 'failed',
        imageUrl: undefined,
        filePath: '/asset_defs/props/pickaxe.yaml',
      },
    ]);
  });

  it('exports storyboard script content from content.story for the detail panel', () => {
    const context = createToolContext('demo');

    context.vfs.createFile(
      '/storyboards/scene-001.yaml',
      stringifyYAML({
        meta: { id: 'scene-001', version: '1.0' },
        content: {
          sequence: 1,
          title: '矿道交谈',
          story: '杜休在矿道里遇到了孙姓青年。',
          action: '两人短暂交谈。',
          scene: '矿道',
          duration: '5s',
          characters: ['杜休', '孙姓青年'],
        },
        tasks: {
          image: {
            params: { prompt: '矿道中的两人' },
            latest: {
              status: 'success',
              output: 'assets/images/scene-001.png',
            },
          },
          video: {
            params: { prompt: '镜头缓慢推进' },
            latest: {
              status: 'pending',
            },
          },
        },
        refs: {
          images: ['assets/images/ref-1.png'],
        },
      })
    );

    const { storyboards } = exportToExistingData(context);

    expect(storyboards).toEqual([
      {
        id: 'scene-001',
        sequenceNumber: 1,
        title: '矿道交谈',
        description: '杜休在矿道里遇到了孙姓青年。',
        script: '杜休在矿道里遇到了孙姓青年。',
        prompt: '矿道中的两人',
        videoPrompt: '镜头缓慢推进',
        imageUrl: '/api/vfs?projectId=demo&path=.%2Fassets%2Fimages%2Fscene-001.png',
        videoUrl: undefined,
        status: 'completed',
        refAssetIds: ['assets/images/ref-1.png'],
        filePath: '/storyboards/scene-001.yaml',
        grid: undefined,
        parentId: undefined,
      },
    ]);
  });
});
