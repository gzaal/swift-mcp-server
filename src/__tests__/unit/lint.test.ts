import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lintRun } from '../../tools/lint.js';
import * as exec from '../../utils/exec.js';

// Mock the exec module
vi.mock('../../utils/exec.js', () => ({
  which: vi.fn(),
  runCommand: vi.fn(),
}));

const mockedWhich = vi.mocked(exec.which);
const mockedRunCommand = vi.mocked(exec.runCommand);

describe('lintRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('when swiftlint is available', () => {
    it('should run swiftlint and return results', async () => {
      mockedWhich.mockResolvedValueOnce('/usr/local/bin/swiftlint');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '[]',
        stderr: '',
      });

      const result = await lintRun({ path: '/tmp/test.swift' });

      expect(result.ok).toBe(true);
      expect(result.code).toBe(0);
      expect(result.stdout).toBe('[]');
    });

    it('should use default path when not specified', async () => {
      mockedWhich.mockResolvedValueOnce('/usr/local/bin/swiftlint');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '[]',
        stderr: '',
      });

      await lintRun({});

      expect(mockedRunCommand).toHaveBeenCalledWith(
        '/usr/local/bin/swiftlint',
        ['lint', '--quiet', '--reporter', 'json', '.'],
        expect.any(Object)
      );
    });

    it('should pass config path when specified', async () => {
      mockedWhich.mockResolvedValueOnce('/usr/local/bin/swiftlint');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '[]',
        stderr: '',
      });

      await lintRun({ configPath: '/path/to/.swiftlint.yml' });

      expect(mockedRunCommand).toHaveBeenCalledWith(
        '/usr/local/bin/swiftlint',
        expect.arrayContaining(['--config', '/path/to/.swiftlint.yml']),
        expect.any(Object)
      );
    });

    it('should use longer timeout in strict mode', async () => {
      mockedWhich.mockResolvedValueOnce('/usr/local/bin/swiftlint');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '[]',
        stderr: '',
      });

      await lintRun({ strict: true });

      expect(mockedRunCommand).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ timeoutMs: 60_000 })
      );
    });

    it('should use normal timeout when not strict', async () => {
      mockedWhich.mockResolvedValueOnce('/usr/local/bin/swiftlint');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '[]',
        stderr: '',
      });

      await lintRun({ strict: false });

      expect(mockedRunCommand).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ timeoutMs: 30_000 })
      );
    });

    it('should return ok=true for exit code 2 (violations found)', async () => {
      mockedWhich.mockResolvedValueOnce('/usr/local/bin/swiftlint');
      mockedRunCommand.mockResolvedValueOnce({
        code: 2,
        stdout: '[{"rule_id": "line_length", "file": "test.swift"}]',
        stderr: '',
      });

      const result = await lintRun({ path: '/tmp/test.swift' });

      expect(result.ok).toBe(true);
      expect(result.code).toBe(2);
    });

    it('should return ok=false for other exit codes', async () => {
      mockedWhich.mockResolvedValueOnce('/usr/local/bin/swiftlint');
      mockedRunCommand.mockResolvedValueOnce({
        code: 1,
        stdout: '',
        stderr: 'error: could not read file',
      });

      const result = await lintRun({ path: '/nonexistent.swift' });

      expect(result.ok).toBe(false);
      expect(result.code).toBe(1);
    });

    it('should include stderr in response', async () => {
      mockedWhich.mockResolvedValueOnce('/usr/local/bin/swiftlint');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '[]',
        stderr: 'warning: something',
      });

      const result = await lintRun({});

      expect(result.stderr).toBe('warning: something');
    });
  });

  describe('when swiftlint is not available', () => {
    it('should return error message', async () => {
      mockedWhich.mockResolvedValueOnce(null);

      const result = await lintRun({});

      expect(result.ok).toBe(false);
      expect(result.message).toContain('SwiftLint not found');
    });
  });
});
