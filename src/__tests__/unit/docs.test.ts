import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { docsSearch } from '../../tools/docs.js';
import { setTestCacheDir, resetCacheDir } from '../setup.js';

describe('docsSearch', () => {
  beforeEach(() => {
    setTestCacheDir();
  });

  afterEach(() => {
    resetCacheDir();
  });

  it('should find results matching query in swift-book', async () => {
    const results = await docsSearch({ query: 'protocol', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.source === 'TSPL')).toBe(true);
  });

  it('should find optionals documentation', async () => {
    const results = await docsSearch({ query: 'optional', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.excerpt.toLowerCase().includes('optional'))).toBe(true);
  });

  it('should return excerpts with matching content', async () => {
    const results = await docsSearch({ query: 'constant', limit: 5 });
    const match = results.find(r => r.excerpt.toLowerCase().includes('constant'));
    expect(match).toBeDefined();
  });

  it('should respect limit parameter', async () => {
    const results = await docsSearch({ query: 'swift', limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('should return empty array for non-matching query', async () => {
    const results = await docsSearch({ query: 'xyznonexistent123', limit: 5 });
    expect(results).toEqual([]);
  });

  it('should search API Design Guidelines', async () => {
    const results = await docsSearch({ query: 'clarity', limit: 5 });
    expect(results.some(r => r.source === 'API Design Guidelines')).toBe(true);
  });

  it('should include path in results', async () => {
    const results = await docsSearch({ query: 'protocol', limit: 1 });
    if (results.length > 0) {
      expect(results[0].path).toBeDefined();
      expect(typeof results[0].path).toBe('string');
    }
  });
});
