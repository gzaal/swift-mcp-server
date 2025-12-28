import { describe, it, expect } from 'vitest';
import { guidelinesCheck } from '../../tools/guidelines.js';

describe('guidelinesCheck', () => {
  describe('TypeNaming rule', () => {
    it('should detect lowercase type names', async () => {
      const result = await guidelinesCheck({ code: 'struct myType {}' });
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].rule).toBe('TypeNaming');
      expect(result.issues[0].message).toContain('myType');
    });

    it('should accept UpperCamelCase type names', async () => {
      const result = await guidelinesCheck({ code: 'struct MyType {}' });
      const typeIssues = result.issues.filter(i => i.rule === 'TypeNaming');
      expect(typeIssues).toHaveLength(0);
    });

    it('should detect snake_case type names', async () => {
      const result = await guidelinesCheck({ code: 'class My_Type {}' });
      expect(result.issues.some(i => i.rule === 'TypeNaming')).toBe(true);
    });

    it('should check enums', async () => {
      const result = await guidelinesCheck({ code: 'enum badEnum {}' });
      expect(result.issues.some(i => i.rule === 'TypeNaming')).toBe(true);
    });
  });

  describe('FunctionNaming rule', () => {
    it('should detect uppercase function names', async () => {
      const result = await guidelinesCheck({ code: 'func DoSomething() {}' });
      expect(result.issues.some(i => i.rule === 'FunctionNaming')).toBe(true);
    });

    it('should accept lowerCamelCase function names', async () => {
      const result = await guidelinesCheck({ code: 'func doSomething() {}' });
      const funcIssues = result.issues.filter(i => i.rule === 'FunctionNaming');
      expect(funcIssues).toHaveLength(0);
    });

    it('should detect underscore in function names', async () => {
      const result = await guidelinesCheck({ code: 'func do_something() {}' });
      expect(result.issues.some(i => i.rule === 'FunctionNaming')).toBe(true);
    });
  });

  describe('EnumCaseNaming rule', () => {
    it('should detect uppercase enum cases', async () => {
      const result = await guidelinesCheck({ code: 'enum Status { case Active }' });
      expect(result.issues.some(i => i.rule === 'EnumCaseNaming')).toBe(true);
    });

    it('should accept lowerCamelCase enum cases', async () => {
      const result = await guidelinesCheck({ code: 'enum Status { case active }' });
      const caseIssues = result.issues.filter(i => i.rule === 'EnumCaseNaming');
      expect(caseIssues).toHaveLength(0);
    });
  });

  describe('NoUnderscoreInNames rule', () => {
    it('should detect underscores in identifiers', async () => {
      const result = await guidelinesCheck({ code: 'let my_variable = 1' });
      expect(result.issues.some(i => i.rule === 'NoUnderscoreInNames')).toBe(true);
    });

    it('should not flag single underscore placeholder', async () => {
      const result = await guidelinesCheck({ code: 'let _ = unused' });
      const underscoreIssues = result.issues.filter(i => i.rule === 'NoUnderscoreInNames');
      expect(underscoreIssues).toHaveLength(0);
    });
  });

  describe('AcronymCasing rule', () => {
    it('should detect acronym followed by lowercase letter', async () => {
      // The regex detects prefix + URL/HTTP/JSON/XML + lowercase letter
      // e.g., "requestURLs" has "request" + "URL" + "s"
      const result = await guidelinesCheck({ code: 'let requestURLs = []' });
      expect(result.issues.some(i => i.rule === 'AcronymCasing')).toBe(true);
    });

    it('should detect fetchURLs pattern', async () => {
      const result = await guidelinesCheck({ code: 'func fetchURLs() {}' });
      expect(result.issues.some(i => i.rule === 'AcronymCasing')).toBe(true);
    });

    it('should accept uniform acronym casing without trailing lowercase', async () => {
      const result = await guidelinesCheck({ code: 'let requestURL = ""' });
      const acronymIssues = result.issues.filter(i => i.rule === 'AcronymCasing');
      expect(acronymIssues).toHaveLength(0);
    });
  });

  describe('AppKit/SwiftUI bridge rules', () => {
    it('should warn about local event monitors', async () => {
      const result = await guidelinesCheck({ code: 'NSEvent.addLocalMonitorForEvents(matching: .keyDown) { _ in nil }' });
      expect(result.issues.some(i => i.rule === 'NSEventMonitorUsage')).toBe(true);
    });

    it('should warn about global event monitors', async () => {
      const result = await guidelinesCheck({ code: 'NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { _ in }' });
      expect(result.issues.some(i => i.rule === 'NSEventGlobalMonitor')).toBe(true);
    });

    it('should warn about NSViewRepresentable without acceptsFirstResponder', async () => {
      const code = `
        struct MyView: NSViewRepresentable {
          func makeNSView(context: Context) -> NSView { NSView() }
        }
      `;
      const result = await guidelinesCheck({ code });
      expect(result.issues.some(i => i.rule === 'FirstResponderMissing')).toBe(true);
    });

    it('should not warn if acceptsFirstResponder is present', async () => {
      const code = `
        struct MyView: NSViewRepresentable {
          func makeNSView(context: Context) -> NSView {
            let view = NSView()
            view.acceptsFirstResponder
            return view
          }
        }
      `;
      const result = await guidelinesCheck({ code });
      expect(result.issues.some(i => i.rule === 'FirstResponderMissing')).toBe(false);
    });

    it('should warn about performKeyEquivalent without keyDown', async () => {
      const code = `
        override func performKeyEquivalent(with event: NSEvent) -> Bool {
          return false
        }
      `;
      const result = await guidelinesCheck({ code });
      expect(result.issues.some(i => i.rule === 'PerformKeyEquivalentOnly')).toBe(true);
    });

    it('should warn about NSWindow without identifier', async () => {
      const code = `let window = NSWindow(contentRect: rect, styleMask: [], backing: .buffered, defer: false)`;
      const result = await guidelinesCheck({ code });
      expect(result.issues.some(i => i.rule === 'WindowIdentifierMissing')).toBe(true);
    });
  });

  describe('line number reporting', () => {
    it('should report correct line numbers', async () => {
      const code = `struct Good {}
struct badName {}
struct Another {}`;
      const result = await guidelinesCheck({ code });
      const issue = result.issues.find(i => i.rule === 'TypeNaming');
      expect(issue?.line).toBe(2);
    });
  });

  describe('clean code', () => {
    it('should return no issues for well-formatted code', async () => {
      const code = `
        struct User {
          let id: Int
          var name: String

          func displayName() -> String {
            return name
          }
        }

        enum Status {
          case active
          case inactive
        }
      `;
      const result = await guidelinesCheck({ code });
      expect(result.issues).toHaveLength(0);
    });
  });
});
