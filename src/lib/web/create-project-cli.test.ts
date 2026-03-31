import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../../scripts/create-project.mjs';

describe('create-project CLI', () => {
  it('parses --project as required project id', () => {
    const args = parseArgs(['--workspace', '/tmp/workspace', '--project', 'mining-betrayal']);
    expect(args.workspace).toBe('/tmp/workspace');
    expect(args.project).toBe('mining-betrayal');
  });
});
