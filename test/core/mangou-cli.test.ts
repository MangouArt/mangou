import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../../src/cli/main';

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

  it('SPEC: parses grid split with flags', () => {
    expect(
      parseCliArgs([
        'grid',
        'split',
        'storyboards/grid.yaml',
        '--grid',
        '2x2',
        '--project-root',
        '/tmp/ws/projects/demo',
      ])
    ).toEqual({
      commandPath: ['grid', 'split'],
      positionals: ['storyboards/grid.yaml'],
      flags: {
        grid: '2x2',
        projectRoot: '/tmp/ws/projects/demo',
      },
    });
  });

  it('SPEC: handles help and unknown commands', () => {
    expect(parseCliArgs(['help'])).toEqual({
      commandPath: ['help'],
      positionals: [],
      flags: {},
    });
    expect(parseCliArgs(['unknown'])).toEqual({
      commandPath: ['unknown'],
      positionals: [],
      flags: {},
    });
    expect(parseCliArgs([])).toEqual({
      commandPath: ['help'],
      positionals: [],
      flags: {},
    });
  });
});
