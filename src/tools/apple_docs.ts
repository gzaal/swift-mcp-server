import { join, sep, resolve } from "node:path";
import { CACHE_DIR, pathExists } from "../utils/cache.js";
import { searchInFiles, readYamlFile } from "../utils/index.js";
import fg from "fast-glob";
import { readFile } from "node:fs/promises";

export type AppleDocsSearchInput = { query: string; frameworks?: string[]; limit?: number };

export type AppleDocHit = {
  symbol: string;
  framework?: string;
  summary?: string;
  snippet?: string;
  url?: string;
  takeaways?: string[];
  path?: string;
};

function deriveFrameworkFromPath(p: string): string | undefined {
  const parts = p.split(sep);
  const idx = parts.lastIndexOf("apple-docs");
  if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  return undefined;
}

function deriveSymbolFromPath(p: string): string {
  const base = p.split(sep).pop() || p;
  const name = base.replace(/\.(json|md|markdown|html)$/i, "");
  return name;
}

function normalizeSymbol(s: string): string {
  return s
    .replace(/\(.*?\)/g, "") // drop parameter lists
    .replace(/:/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function scoreHit(hit: AppleDocHit, q: string, frameworks?: string[]): number {
  let score = 0;
  const nq = normalizeSymbol(q);
  const ns = normalizeSymbol(hit.symbol || "");
  if (ns === nq) score += 50; // exact symbol match
  if ((hit.symbol || "").toLowerCase().includes(q.toLowerCase())) score += 10;
  if (hit.summary && hit.summary.toLowerCase().includes(q.toLowerCase())) score += 5;
  if (hit.snippet) score += 2;
  if (frameworks && frameworks.length && hit.framework && frameworks.includes(hit.framework)) score += 8;
  return score;
}

export async function appleDocsSearch({ query, frameworks, limit = 5 }: AppleDocsSearchInput): Promise<AppleDocHit[]> {
  const bases = [join(CACHE_DIR, "apple-docs"), resolve(process.cwd(), ".cache", "apple-docs")];
  const base = (await pathExists(bases[0])) ? bases[0] : bases[1];
  let patterns = ["**/*.json", "**/*.md", "**/*.markdown", "**/*.html"]; // DocC JSON, markdown, HTML
  if (frameworks && frameworks.length > 0) {
    patterns = frameworks.flatMap((fw) => [
      `${fw}/**/*.json`,
      `${fw}/**/*.md`,
      `${fw}/**/*.markdown`,
      `${fw}/**/*.html`,
    ]);
  }
  const matches = await searchInFiles(base, patterns, query, limit * 3);
  const out: AppleDocHit[] = [];
  for (const m of matches) {
    try {
      const framework = deriveFrameworkFromPath(m.path);
      let symbol = deriveSymbolFromPath(m.path);
      let summary: string | undefined = m.excerpt;
      let snippet: string | undefined;
      let url: string | undefined;
      if (m.path.endsWith(".json")) {
        const txt = await readFile(m.path, "utf8");
        const js = JSON.parse(txt);
        symbol = js.identifier?.title || js.symbol?.title || symbol;
        summary = js.abstract?.map?.((n: any) => (typeof n === "string" ? n : n.text)).join(" ") || summary;
        url = js.url || js.referenceURL || url;
      } else if (m.path.endsWith(".md") || m.path.endsWith(".markdown")) {
        // try first code block as snippet
        const txt = await readFile(m.path, "utf8");
        const codeMatch = txt.match(/```[\s\S]*?```/);
        if (codeMatch) snippet = codeMatch[0].replace(/```[a-zA-Z]*\n?|```/g, "").trim();
      }
      out.push({ symbol, framework, summary, snippet, url, path: m.path, takeaways: [] });
    } catch {
      // ignore parse errors
    }
  }
  // Rank hits
  out.sort((a, b) => scoreHit(b, query, frameworks) - scoreHit(a, query, frameworks));
  // If frameworks filter provided, prefer those first
  if (frameworks && frameworks.length) {
    out.sort((a, b) => {
      const aIn = a.framework && frameworks.includes(a.framework) ? 0 : 1;
      const bIn = b.framework && frameworks.includes(b.framework) ? 0 : 1;
      if (aIn !== bIn) return aIn - bIn;
      return 0;
    });
  }
  return out.slice(0, limit);
}

export type SymbolAliasMap = Record<string, string[]>; // canonical -> aliases

export async function swiftSymbolLookup(symbolOrSelector: string): Promise<AppleDocHit[]> {
  const q = symbolOrSelector.trim();
  const candidates = [
    join(CACHE_DIR, "content", "symbols", "aliases.yaml"),
    resolve(process.cwd(), "content", "symbols", "aliases.yaml"),
  ];
  let aliases: SymbolAliasMap = {};
  for (const p of candidates) {
    const data = await readYamlFile<SymbolAliasMap>(p);
    if (data) { aliases = data; break; }
  }
  const canonicals = new Set<string>();
  for (const [canonical, list] of Object.entries(aliases)) {
    if (canonical === q || list?.includes(q)) {
      canonicals.add(canonical);
    }
  }
  const queries = canonicals.size > 0 ? Array.from(canonicals) : [q];
  const results: AppleDocHit[] = [];
  for (const qq of queries) {
    const hits = await appleDocsSearch({ query: qq, limit: 5 });
    // prefer exact filename matches
    hits.sort((a, b) => (a.symbol === qq ? -1 : 0) - (b.symbol === qq ? -1 : 0));
    results.push(...hits);
  }
  // de-dup by symbol+framework
  const seen = new Set<string>();
  return results.filter((h) => {
    const k = `${h.framework}|${h.symbol}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 10);
}
