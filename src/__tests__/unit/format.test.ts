import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatApply } from '../../tools/format.js';
import * as exec from '../../utils/exec.js';

// Mock the exec module
vi.mock('../../utils/exec.js', () => ({
  which: vi.fn(),
  runCommand: vi.fn(),
}));

const mockedWhich = vi.mocked(exec.which);
const mockedRunCommand = vi.mocked(exec.runCommand);

describe('formatApply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('with swift-format available', () => {
    it('should format code using swift-format', async () => {
      mockedWhich.mockResolvedValueOnce('/usr/bin/swift-format');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'struct Foo {\n    let x: Int\n}\n',
        stderr: '',
      });

      const result = await formatApply({ code: 'struct Foo{let x:Int}' });

      expect(result.ok).toBe(true);
      expect(result.tool).toBe('swift-format');
      expect(result.formatted).toBe('struct Foo {\n    let x: Int\n}\n');
    });

    it('should pass assume-filename to swift-format', async () => {
      mockedWhich.mockResolvedValueOnce('/usr/bin/swift-format');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'formatted',
        stderr: '',
      });

      await formatApply({ code: 'let x = 1', assumeFilepath: 'MyFile.swift' });

      expect(mockedRunCommand).toHaveBeenCalledWith(
        '/usr/bin/swift-format',
        ['format', '--assume-filename', 'MyFile.swift'],
        expect.objectContaining({ input: 'let x = 1' })
      );
    });

    it('should use default assume-filename when not specified', async () => {
      mockedWhich.mockResolvedValueOnce('/usr/bin/swift-format');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'formatted',
        stderr: '',
      });

      await formatApply({ code: 'let x = 1' });

      expect(mockedRunCommand).toHaveBeenCalledWith(
        '/usr/bin/swift-format',
        ['format', '--assume-filename', 'input.swift'],
        expect.any(Object)
      );
    });
  });

  describe('fallback to SwiftFormat', () => {
    it('should fallback to swiftformat when swift-format fails', async () => {
      // swift-format not found
      mockedWhich.mockResolvedValueOnce(null);
      // swiftformat found
      mockedWhich.mockResolvedValueOnce('/usr/local/bin/swiftformat');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'formatted by swiftformat',
        stderr: '',
      });

      const result = await formatApply({ code: 'let x=1' });

      expect(result.ok).toBe(true);
      expect(result.tool).toBe('SwiftFormat');
      expect(result.formatted).toBe('formatted by swiftformat');
    });

    it('should pass swift version to swiftformat', async () => {
      mockedWhich.mockResolvedValueOnce(null);
      mockedWhich.mockResolvedValueOnce('/usr/local/bin/swiftformat');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'formatted',
        stderr: '',
      });

      await formatApply({ code: 'let x = 1', swiftVersion: '5.9' });

      expect(mockedRunCommand).toHaveBeenCalledWith(
        '/usr/local/bin/swiftformat',
        ['--stdin', '--quiet', '--swiftversion', '5.9'],
        expect.any(Object)
      );
    });

    it('should use default swift version when not specified', async () => {
      mockedWhich.mockResolvedValueOnce(null);
      mockedWhich.mockResolvedValueOnce('/usr/local/bin/swiftformat');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'formatted',
        stderr: '',
      });

      await formatApply({ code: 'let x = 1' });

      expect(mockedRunCommand).toHaveBeenCalledWith(
        '/usr/local/bin/swiftformat',
        ['--stdin', '--quiet', '--swiftversion', '6'],
        expect.any(Object)
      );
    });
  });

  describe('no formatter available', () => {
    it('should return error when no formatter is found', async () => {
      mockedWhich.mockResolvedValue(null);

      const result = await formatApply({ code: 'let x = 1' });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('No formatter found');
    });
  });

  describe('formatter failure', () => {
    it('should fallback when swift-format returns non-zero', async () => {
      mockedWhich.mockResolvedValueOnce('/usr/bin/swift-format');
      mockedRunCommand.mockResolvedValueOnce({
        code: 1,
        stdout: '',
        stderr: 'error',
      });
      mockedWhich.mockResolvedValueOnce('/usr/local/bin/swiftformat');
      mockedRunCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'formatted',
        stderr: '',
      });

      const result = await formatApply({ code: 'invalid{' });

      expect(result.ok).toBe(true);
      expect(result.tool).toBe('SwiftFormat');
    });
  });
});
