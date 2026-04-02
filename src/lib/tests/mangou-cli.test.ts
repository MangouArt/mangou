import { describe, expect, it, vi } from 'vitest';
import {
  dispatchCliCommand,
  parseCliArgs,
} from '../../../scripts/mangou.mjs';

describe('mangou CLI', () => {
  it('SPEC: parses workspace init as a structured command', () => {
    expect(parseCliArgs(['workspace', 'init', '--workspace', '/tmp/demo'])).toEqual({
      commandPath: ['workspace', 'init'],
      positionals: [],
      flags: {
        workspace: '/tmp/demo',
      },
    });
  });

  it('SPEC: parses generate image with yaml positional and provider override', () => {
    expect(
      parseCliArgs([
        'generate',
        'image',
        'storyboards/s1.yaml',
        '--provider',
        'bltai',
        '--debug',
      ])
    ).toEqual({
      commandPath: ['generate', 'image'],
      positionals: ['storyboards/s1.yaml'],
      flags: {
        provider: 'bltai',
        debug: true,
      },
    });
  });

  it('SPEC: dispatches web start to the startWeb handler', async () => {
    const handlers = {
      initWorkspace: vi.fn(),
      createProject: vi.fn(),
      startWeb: vi.fn().mockResolvedValue({ port: 3000 }),
      stopWeb: vi.fn(),
      webStatus: vi.fn(),
      generate: vi.fn(),
      stitch: vi.fn(),
      splitGrid: vi.fn(),
    };

    await expect(
      dispatchCliCommand(parseCliArgs(['web', 'start', '--workspace', '/tmp/ws', '--port', '4123']), handlers)
    ).resolves.toEqual({ port: 3000 });

    expect(handlers.startWeb).toHaveBeenCalledWith({
      workspaceRoot: '/tmp/ws',
      port: 4123,
      json: false,
      verbose: false,
    });
  });

  it('SPEC: dispatches generate video to the generate handler with legacy-compatible argv', async () => {
    const handlers = {
      initWorkspace: vi.fn(),
      createProject: vi.fn(),
      startWeb: vi.fn(),
      stopWeb: vi.fn(),
      webStatus: vi.fn(),
      generate: vi.fn().mockResolvedValue({ ok: true }),
      stitch: vi.fn(),
      splitGrid: vi.fn(),
    };

    await dispatchCliCommand(
      parseCliArgs([
        'generate',
        'video',
        'storyboards/s1.yaml',
        '--workspace',
        '/tmp/ws',
        '--project',
        '/tmp/ws/projects/demo',
        '--provider',
        'kie',
        '--debug',
      ]),
      handlers
    );

    expect(handlers.generate).toHaveBeenCalledWith({
      type: 'video',
      yamlPath: 'storyboards/s1.yaml',
      argv: [
        'storyboards/s1.yaml',
        'video',
        '--workspace',
        '/tmp/ws',
        '--project',
        '/tmp/ws/projects/demo',
        '--provider',
        'kie',
        '--debug',
      ],
      json: false,
      verbose: false,
    });
  });

  it('SPEC: rejects unknown commands with a usage error', async () => {
    const handlers = {
      initWorkspace: vi.fn(),
      createProject: vi.fn(),
      startWeb: vi.fn(),
      stopWeb: vi.fn(),
      webStatus: vi.fn(),
      generate: vi.fn(),
      stitch: vi.fn(),
      splitGrid: vi.fn(),
    };

    await expect(
      dispatchCliCommand(parseCliArgs(['video', 'start']), handlers)
    ).rejects.toThrow('Usage:');
  });

  it('SPEC: rejects missing yaml for generate image', async () => {
    const handlers = {
      initWorkspace: vi.fn(),
      createProject: vi.fn(),
      startWeb: vi.fn(),
      stopWeb: vi.fn(),
      webStatus: vi.fn(),
      generate: vi.fn(),
      stitch: vi.fn(),
      splitGrid: vi.fn(),
    };

    await expect(
      dispatchCliCommand(parseCliArgs(['generate', 'image']), handlers)
    ).rejects.toThrow('Usage: mangou generate image <yaml>');
  });
});
