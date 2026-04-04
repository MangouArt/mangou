import { describe, expect, it } from 'vitest';
import { updateGenerationStatus } from '../../src/cli/core/vfs/yaml';

describe('YAML utilities', () => {
  describe('updateGenerationStatus', () => {
    it('updates a single document YAML', () => {
      const content = `
meta:
  id: test
tasks:
  image:
    params:
      prompt: test prompt
`;
      const updated = updateGenerationStatus(content, 'image', {
        status: 'success',
        output: 'assets/images/test.png'
      });
      
      expect(updated).toContain('status: success');
      expect(updated).toContain('output: assets/images/test.png');
    });

    it('updates a specific document in a multi-document YAML', () => {
      const content = `
meta:
  id: doc1
tasks:
  image:
    params:
      prompt: p1
---
meta:
  id: doc2
tasks:
  image:
    params:
      prompt: p2
`;
      const updated = updateGenerationStatus(content, 'image', {
        status: 'success',
        output: 'out2.png'
      }, 1);
      
      const sections = updated.split('---\n');
      expect(sections).toHaveLength(2);
      expect(sections[0]).not.toContain('output: out2.png');
      expect(sections[1]).toContain('id: doc2');
      expect(sections[1]).toContain('status: success');
      expect(sections[1]).toContain('output: out2.png');
    });

    it('returns original content if docIndex is out of bounds', () => {
      const content = 'meta: { id: test }';
      const updated = updateGenerationStatus(content, 'image', { status: 'success' }, 5);
      expect(updated).toBe(content);
    });
  });
});
