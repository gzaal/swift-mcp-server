export type GuidelinesCheckInput = { code: string };

type Issue = { rule: string; message: string; line?: number };

function lineNumberFromIndex(src: string, index: number): number {
  return src.slice(0, index).split(/\r?\n/).length;
}

export async function guidelinesCheck({ code }: GuidelinesCheckInput) {
  const issues: Issue[] = [];

  // Heuristic: Type names UpperCamelCase (struct/class/enum)
  const typeDeclRe = /\b(?:struct|class|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  for (const m of code.matchAll(typeDeclRe)) {
    const name = m[1];
    if (!/^([A-Z][a-z0-9]+)+$/.test(name)) {
      issues.push({
        rule: "TypeNaming",
        message: `Type '${name}' should use UpperCamelCase`,
        line: lineNumberFromIndex(code, m.index ?? 0),
      });
    }
  }

  // Heuristic: function/variable lowerCamelCase
  const funcDeclRe = /\bfunc\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  for (const m of code.matchAll(funcDeclRe)) {
    const name = m[1];
    if (!/^[a-z][A-Za-z0-9]*$/.test(name)) {
      issues.push({
        rule: "FunctionNaming",
        message: `Function '${name}' should use lowerCamelCase`,
        line: lineNumberFromIndex(code, m.index ?? 0),
      });
    }
  }

  // Heuristic: enum cases lowerCamelCase
  const caseDeclRe = /\bcase\s+([A-Za-z_][A-Za-z0-9_]*)(?=\b)/g;
  for (const m of code.matchAll(caseDeclRe)) {
    const name = m[1];
    if (!/^[a-z][A-Za-z0-9]*$/.test(name)) {
      issues.push({
        rule: "EnumCaseNaming",
        message: `Enum case '${name}' should use lowerCamelCase`,
        line: lineNumberFromIndex(code, m.index ?? 0),
      });
    }
  }

  // Heuristic: discourage underscores in identifiers (except for _ placeholder)
  const identRe = /\b([A-Za-z][A-Za-z0-9_]*_[A-Za-z0-9_]+)\b/g;
  for (const m of code.matchAll(identRe)) {
    const name = m[1];
    issues.push({
      rule: "NoUnderscoreInNames",
      message: `Consider avoiding underscores in identifier '${name}' per Swift API Design Guidelines`,
      line: lineNumberFromIndex(code, m.index ?? 0),
    });
  }

  // Heuristic: acronyms should be uniformly cased (URL, HTTP). Spot obvious bad cases
  const badAcronymRe = /\b([A-Za-z]+)(URL|HTTP|JSON|XML)([a-z])/g;
  for (const m of code.matchAll(badAcronymRe)) {
    issues.push({
      rule: "AcronymCasing",
      message: `Use consistent acronym casing (e.g., 'url' in lowerCamelCase: 'requestURL' not 'requestUrl')`,
      line: lineNumberFromIndex(code, m.index ?? 0),
    });
  }

  return { issues };
}

