import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StoryboardDetail } from '@/components/dashboard/agent/storyboard-detail';
import type { Asset, Storyboard } from '@/stores/director-agent-store';

describe('StoryboardDetail', () => {
  it('SPEC: 只读详情仅展示原剧本和引用资产，不展示提示词', () => {
    const storyboard: Storyboard = {
      id: 'sb-1',
      sequenceNumber: 1,
      title: '镜头一',
      description: '描述',
      script: '角色走进仓库，抬头看向灯光。',
      prompt: 'cinematic prompt',
      videoPrompt: 'video prompt',
      status: 'completed',
      refAssetIds: ['char-1', 'scene-1'],
      imageUrl: 'https://example.com/frame.png',
    };

    const assets: Asset[] = [
      {
        id: 'char-1',
        type: 'character',
        name: '阿明',
        description: '主角',
        status: 'completed',
      },
      {
        id: 'scene-1',
        type: 'scene',
        name: '旧仓库',
        description: '夜景场景',
        status: 'completed',
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(StoryboardDetail, {
        storyboard,
        assets,
        projectId: 'demo',
      }),
    );

    expect(html).toContain('原剧本');
    expect(html).toContain('角色走进仓库，抬头看向灯光。');
    expect(html).toContain('参考资产');
    expect(html).toContain('阿明');
    expect(html).toContain('旧仓库');
    expect(html).not.toContain('当前提示词');
    expect(html).not.toContain('cinematic prompt');
    expect(html).not.toContain('video prompt');
  });
});
