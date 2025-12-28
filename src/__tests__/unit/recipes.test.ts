import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { swiftRecipeLookup } from '../../tools/recipes.js';
import { setTestCacheDir, resetCacheDir } from '../setup.js';

describe('swiftRecipeLookup', () => {
  beforeEach(() => {
    setTestCacheDir();
  });

  afterEach(() => {
    resetCacheDir();
  });

  it('should find recipe by id', async () => {
    const results = await swiftRecipeLookup({ queryOrId: 'video-overlay-swiftui', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('video-overlay-swiftui');
  });

  it('should find recipe by keyword', async () => {
    const results = await swiftRecipeLookup({ queryOrId: 'video', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should find recipe by tag', async () => {
    const results = await swiftRecipeLookup({ queryOrId: 'overlay', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.tags?.includes('overlay'))).toBe(true);
  });

  it('should return recipe metadata', async () => {
    const results = await swiftRecipeLookup({ queryOrId: 'video-overlay-swiftui', limit: 1 });
    expect(results.length).toBe(1);
    const recipe = results[0];
    expect(recipe.id).toBeDefined();
    expect(recipe.title).toBeDefined();
  });

  it('should include steps when available', async () => {
    const results = await swiftRecipeLookup({ queryOrId: 'video-overlay-swiftui', limit: 1 });
    expect(results.length).toBe(1);
    expect(results[0].steps).toBeDefined();
    expect(Array.isArray(results[0].steps)).toBe(true);
  });

  it('should include snippet when available', async () => {
    const results = await swiftRecipeLookup({ queryOrId: 'video', limit: 1 });
    if (results.length > 0 && results[0].snippet) {
      expect(typeof results[0].snippet).toBe('string');
    }
  });

  it('should include references when available', async () => {
    const results = await swiftRecipeLookup({ queryOrId: 'video-overlay-swiftui', limit: 1 });
    expect(results.length).toBe(1);
    expect(results[0].references).toBeDefined();
    expect(Array.isArray(results[0].references)).toBe(true);
  });

  it('should respect limit parameter', async () => {
    const results = await swiftRecipeLookup({ queryOrId: 'video', limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('should return empty array for non-matching query', async () => {
    const results = await swiftRecipeLookup({ queryOrId: 'xyznonexistent123', limit: 5 });
    expect(results).toEqual([]);
  });
});
