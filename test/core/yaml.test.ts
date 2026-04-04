import { describe, it, expect } from 'vitest';
import { parseYAML, stringifyYAML, validateYAMLFile } from '../../src/cli/core/yaml';

describe('YAML utilities', () => {
  describe('parseYAML', () => {
    it('parses basic YAML correctly', () => {
      const content = 'meta:\n  id: test\ncontent:\n  title: Title';
      const result = parseYAML(content);
      expect(result.meta.id).toBe('test');
      expect(result.content.title).toBe('Title');
    });

    it('throws error for empty content', () => {
      expect(() => parseYAML('')).toThrow();
    });
  });

  describe('stringifyYAML', () => {
    it('stringifies objects correctly', () => {
      const data = { meta: { id: 'test' } };
      const result = stringifyYAML(data);
      expect(result).toContain('id: test');
    });
  });

  describe('validateYAMLFile', () => {
    it('validates basic structure correctly', () => {
      const valid = { meta: { id: 'test' }, content: { title: 'T' } };
      expect(validateYAMLFile(valid, '/any.yaml')).toBe(true);
      
      const invalid = { only: 'meta' };
      expect(validateYAMLFile(invalid, '/any.yaml')).toBe(false);
    });
  });
});
