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

  it('SPEC: dispatches workspace init to the initWorkspace handler', async () => {
    const handlers = {
      initWorkspace: vi.fn().mockResolvedValue({ ok: true }),
      createProject: vi.fn(),
      startWeb: vi.fn(),
      stopWeb: vi.fn(),
      webStatus: vi.fn(),
      generate: vi.fn(),
      stitch: vi.fn(),
      splitGrid: vi.fn(),
    };

    await dispatchCliCommand(parseCliArgs(['workspace', 'init', '--workspace', '/tmp/ws']), handlers);

    expect(handlers.initWorkspace).toHaveBeenCalledWith({
      workspaceRoot: '/tmp/ws',
      json: false,
      verbose: false,
    });
  });

  it('SPEC: dispatches project create to the createProject handler', async () => {
    const handlers = {
      initWorkspace: vi.fn(),
      createProject: vi.fn().mockResolvedValue({ id: 'demo' }),
      startWeb: vi.fn(),
      stopWeb: vi.fn(),
      webStatus: vi.fn(),
      generate: vi.fn(),
      stitch: vi.fn(),
      splitGrid: vi.fn(),
    };

    await dispatchCliCommand(
      parseCliArgs([
        'project',
        'create',
        '--workspace',
        '/tmp/ws',
        '--project',
        'demo',
        '--name',
        'Demo Project',
        '--description',
        'sample',
      ]),
      handlers
    );

    expect(handlers.createProject).toHaveBeenCalledWith({
      workspaceRoot: '/tmp/ws',
      projectId: 'demo',
      name: 'Demo Project',
      description: 'sample',
      json: false,
      verbose: false,
    });
  });

  it('SPEC: dispatches web stop and web status to their handlers', async () => {
    const handlers = {
      initWorkspace: vi.fn(),
      createProject: vi.fn(),
      startWeb: vi.fn(),
      stopWeb: vi.fn().mockResolvedValue({ stopped: true }),
      webStatus: vi.fn().mockResolvedValue({ status: 'running' }),
      generate: vi.fn(),
      stitch: vi.fn(),
      splitGrid: vi.fn(),
    };

    await dispatchCliCommand(parseCliArgs(['web', 'stop', '--workspace', '/tmp/ws']), handlers);
    await dispatchCliCommand(parseCliArgs(['web', 'status', '--workspace', '/tmp/ws']), handlers);

    expect(handlers.stopWeb).toHaveBeenCalledWith({
      workspaceRoot: '/tmp/ws',
      json: false,
      verbose: false,
    });
    expect(handlers.webStatus).toHaveBeenCalledWith({
      workspaceRoot: '/tmp/ws',
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

  it('SPEC: dispatches stitch with explicit project root', async () => {
    const handlers = {
      initWorkspace: vi.fn(),
      createProject: vi.fn(),
      startWeb: vi.fn(),
      stopWeb: vi.fn(),
      webStatus: vi.fn(),
      generate: vi.fn(),
      stitch: vi.fn().mockResolvedValue({ path: '/tmp/out.mp4' }),
      splitGrid: vi.fn(),
    };

    await dispatchCliCommand(parseCliArgs(['stitch', '/tmp/ws/projects/demo', '--output', 'final.mp4']), handlers);

    expect(handlers.stitch).toHaveBeenCalledWith({
      projectRoot: '/tmp/ws/projects/demo',
      outputName: 'final.mp4',
      json: false,
      verbose: false,
    });
  });

  it('SPEC: dispatches grid split with module argv', async () => {
    const handlers = {
      initWorkspace: vi.fn(),
      createProject: vi.fn(),
      startWeb: vi.fn(),
      stopWeb: vi.fn(),
      webStatus: vi.fn(),
      generate: vi.fn(),
      stitch: vi.fn(),
      splitGrid: vi.fn().mockResolvedValue({ outputs: [] }),
    };

    await dispatchCliCommand(
      parseCliArgs([
        'grid',
        'split',
        'storyboards/grid.yaml',
        '--grid',
        '2x2',
        '--targets',
        'storyboards/a.yaml,storyboards/b.yaml',
        '--project-root',
        '/tmp/ws/projects/demo',
        '--workspace-root',
        '/tmp/ws',
      ]),
      handlers
    );

    expect(handlers.splitGrid).toHaveBeenCalledWith({
      parentYaml: 'storyboards/grid.yaml',
      argv: [
        'storyboards/grid.yaml',
        '--grid',
        '2x2',
        '--targets',
        'storyboards/a.yaml,storyboards/b.yaml',
        '--project-root',
        '/tmp/ws/projects/demo',
        '--workspace-root',
        '/tmp/ws',
      ],
      json: false,
      verbose: false,
    });
  });

  it('SPEC: rejects missing project id for project create', async () => {
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
      dispatchCliCommand(parseCliArgs(['project', 'create']), handlers)
    ).rejects.toThrow('Usage: mangou project create --project <id>');
  });

  it('SPEC: rejects missing yaml for grid split', async () => {
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
      dispatchCliCommand(parseCliArgs(['grid', 'split']), handlers)
    ).rejects.toThrow('Usage: mangou grid split <parentYaml>');
  });
});
