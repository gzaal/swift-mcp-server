import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { evolutionLookup } from '../../tools/evolution.js';
import { setTestCacheDir, resetCacheDir } from '../setup.js';

describe('evolutionLookup', () => {
  beforeEach(() => {
    setTestCacheDir();
  });

  afterEach(() => {
    resetCacheDir();
  });

  it('should find proposal by SE number', async () => {
    const results = await evolutionLookup({ query: 'SE-0001', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('SE-0001');
  });

  it('should find proposal by keyword', async () => {
    const results = await evolutionLookup({ query: 'currying', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.title.toLowerCase().includes('currying'))).toBe(true);
  });

  it('should find proposal by topic', async () => {
    const results = await evolutionLookup({ query: 'keywords', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should return proposal metadata', async () => {
    const results = await evolutionLookup({ query: 'SE-0001', limit: 1 });
    expect(results.length).toBe(1);
    const proposal = results[0];
    expect(proposal.id).toBeDefined();
    expect(proposal.title).toBeDefined();
    expect(proposal.path).toBeDefined();
  });

  it('should respect limit parameter', async () => {
    const results = await evolutionLookup({ query: 'swift', limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('should return empty array for non-matching query', async () => {
    const results = await evolutionLookup({ query: 'xyznonexistent123', limit: 5 });
    expect(results).toEqual([]);
  });

  it('should handle partial SE number match', async () => {
    const results = await evolutionLookup({ query: '0001', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
  });
});
