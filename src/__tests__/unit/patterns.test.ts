import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cocoaPatternsSearch } from '../../tools/patterns.js';
import { setTestCacheDir, resetCacheDir } from '../setup.js';

describe('cocoaPatternsSearch', () => {
  beforeEach(() => {
    setTestCacheDir();
  });

  afterEach(() => {
    resetCacheDir();
  });

  it('should find patterns by tag', async () => {
    const results = await cocoaPatternsSearch({ queryOrTag: 'keyboard', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.tags?.includes('keyboard'))).toBe(true);
  });

  it('should find patterns by title keyword', async () => {
    const results = await cocoaPatternsSearch({ queryOrTag: 'focus', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should find patterns by summary content', async () => {
    const results = await cocoaPatternsSearch({ queryOrTag: 'responder', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    // Should match keyboard_focus.yaml which has "responder" in summary
  });

  it('should return pattern metadata', async () => {
    const results = await cocoaPatternsSearch({ queryOrTag: 'keyboard', limit: 1 });
    expect(results.length).toBe(1);
    const pattern = results[0];
    expect(pattern.id).toBeDefined();
    expect(pattern.title).toBeDefined();
    expect(pattern.tags).toBeDefined();
  });

  it('should include snippet when available', async () => {
    const results = await cocoaPatternsSearch({ queryOrTag: 'keyboard', limit: 1 });
    expect(results.length).toBe(1);
    expect(results[0].snippet).toBeDefined();
  });

  it('should include takeaways when available', async () => {
    const results = await cocoaPatternsSearch({ queryOrTag: 'keyboard', limit: 1 });
    expect(results.length).toBe(1);
    expect(results[0].takeaways).toBeDefined();
    expect(Array.isArray(results[0].takeaways)).toBe(true);
  });

  it('should respect limit parameter', async () => {
    const results = await cocoaPatternsSearch({ queryOrTag: 'appkit', limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('should return empty array for non-matching query', async () => {
    const results = await cocoaPatternsSearch({ queryOrTag: 'xyznonexistent123', limit: 5 });
    expect(results).toEqual([]);
  });

  it('should find window-related patterns', async () => {
    const results = await cocoaPatternsSearch({ queryOrTag: 'window', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    // Should match patterns with "window" in title or tags
    expect(results.some(r => r.title.toLowerCase().includes('window'))).toBe(true);
  });
});
