import { join, sep, resolve } from "node:path";
import { CACHE_DIR, pathExists } from "../utils/cache.js";
import { searchInFiles, readYamlFile } from "../utils/index.js";
import fg from "fast-glob";
import { readFile } from "node:fs/promises";

export type AppleDocsSearchInput = { query: string; frameworks?: string[]; limit?: number };

export type AppleDocHit = {
  symbol: string;
  framework?: string;
  kind?: string;
  id?: string;
  summary?: string;
  snippet?: string;
  url?: string;
  topics?: string[];
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

function doccURLToWeb(u?: string): string | undefined {
  if (!u) return undefined;
  if (u.startsWith("https://")) return u;
  // doc://com.apple.documentation/documentation/appkit/nswindow
  const m = u.match(/doc:\/\/com\.apple\.documentation\/documentation\/(.*)$/i);
  if (m) {
    return `https://developer.apple.com/documentation/${m[1]}`;
  }
  // relative developer docs path
  if (u.startsWith("documentation/")) return `https://developer.apple.com/${u}`;
  if (u.startsWith("/documentation/")) return `https://developer.apple.com${u}`;
  // Some docsets store referenceURL directly
  return undefined;
}

function flattenInline(nodes: any): string {
  if (!nodes) return "";
  const arr = Array.isArray(nodes) ? nodes : [nodes];
  const parts: string[] = [];
  for (const n of arr) {
    if (!n) continue;
    if (typeof n === "string") { parts.push(n); continue; }
    const t = (n.type || n.kind || "").toString();
    if (n.text) parts.push(String(n.text));
    if (n.spelling) parts.push(String(n.spelling));
    if (n.code) parts.push(String(n.code));
    if (n.children) parts.push(flattenInline(n.children));
    // ignore other node kinds
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function extractDeclarationSnippet(js: any): string | undefined {
  // 1) declarationFragments (DocC symbol pages often include this)
  const declFrags = js?.declarationFragments;
  if (Array.isArray(declFrags) && declFrags.length) {
    const snippet = declFrags.map((f: any) => f.spelling ?? f.text ?? "").join("");
    if (snippet.trim()) return snippet.trim();
  }
  // 2) primaryContentSections with declarations
  const pcs = js?.primaryContentSections;
  if (Array.isArray(pcs)) {
    for (const sec of pcs) {
      if ((sec.kind === "declarations" || sec.type === "declarations") && Array.isArray(sec.declarations) && sec.declarations[0]?.tokens) {
        const tokens = sec.declarations[0].tokens as any[];
        const snippet = tokens.map((t: any) => t.spelling ?? t.text ?? "").join("");
        if (snippet.trim()) return snippet.trim();
      }
      // Some variants: codeListing
      if ((sec.kind === "codeListing" || sec.type === "codeListing") && sec.code) {
        return String(sec.code).trim();
      }
    }
  }
  // 3) variants content
  const variants = js?.variants;
  if (Array.isArray(variants)) {
    for (const v of variants) {
      const snippet = extractDeclarationSnippet(v);
      if (snippet) return snippet;
    }
  }
  return undefined;
}

function extractSummary(js: any): string | undefined {
  const abs = js?.abstract;
  const s = flattenInline(abs);
  if (s) return s;
  const desc = js?.description || js?.overview;
  const d = flattenInline(desc);
  if (d) return d;
  return undefined;
}

function inferFrameworkFromJSON(js: any): string | undefined {
  return js?.metadata?.module?.name || js?.module?.name || undefined;
}

function extractKind(js: any): string | undefined {
  return js?.symbolKind || js?.kind || js?.metadata?.role || undefined;
}

function extractTopics(js: any): string[] {
  const topics: string[] = [];
  const ts = js?.topicSections;
  if (Array.isArray(ts)) {
    for (const sec of ts) {
      if (sec?.title) topics.push(String(sec.title));
    }
  }
  const secs = js?.sections;
  if (Array.isArray(secs)) {
    for (const s of secs) {
      if (s?.title) topics.push(String(s.title));
    }
  }
  return Array.from(new Set(topics));
}

function urlFromReferences(js: any, fallbackTitle?: string): string | undefined {
  const refs = js?.references;
  if (!refs || typeof refs !== "object") return undefined;
  const values = Object.values(refs) as any[];
  // Prefer refs whose title matches symbol
  const titleLc = (fallbackTitle || "").toLowerCase();
  const preferred = values.find((r) => (r?.title || "").toLowerCase() === titleLc && (r?.url));
  if (preferred) return doccURLToWeb(preferred.url);
  // Otherwise pick any symbol/article with a url under documentation/
  for (const r of values) {
    const url = r?.url as string | undefined;
    if (url && /(^|\/)documentation\//.test(url)) return doccURLToWeb(url);
  }
  return undefined;
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
  const dedupe = new Set<string>();
  for (const m of matches) {
    try {
      let framework = deriveFrameworkFromPath(m.path);
      let symbol = deriveSymbolFromPath(m.path);
      let kind: string | undefined;
      let id: string | undefined;
      let summary: string | undefined = m.excerpt;
      let snippet: string | undefined;
      let url: string | undefined;
      if (m.path.endsWith(".json")) {
        const txt = await readFile(m.path, "utf8");
        const js: any = JSON.parse(txt);
        const jTitle = js.title || js.metadata?.title || js.identifier?.title;
        const jSummary = extractSummary(js);
        const jSnippet = extractDeclarationSnippet(js);
        const jURL = doccURLToWeb(js.identifier?.url) || urlFromReferences(js, jTitle) || js.url || js.referenceURL;
        const jFramework = inferFrameworkFromJSON(js) || framework;
        const jKind = extractKind(js);
        const jTopics = extractTopics(js);
        const jId = js.identifier?.url || js.identifier?.identifier || undefined;
        if (jTitle) symbol = String(jTitle);
        if (jSummary) summary = jSummary;
        if (jSnippet) snippet = jSnippet;
        if (jURL) url = jURL;
        framework = jFramework;
        kind = jKind;
        id = jId;
        // attach topics via takeaways field or separate
        if (jTopics && jTopics.length) {
          // we'll attach as topics field on the hit
        }
      } else if (m.path.endsWith(".md") || m.path.endsWith(".markdown")) {
        const txt = await readFile(m.path, "utf8");
        const codeMatch = txt.match(/```[\s\S]*?```/);
        if (codeMatch) snippet = codeMatch[0].replace(/```[a-zA-Z]*\n?|```/g, "").trim();
      }
      const key = `${(framework || "").toLowerCase()}|${(id || symbol || "").toLowerCase()}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      const topics = extractTopics as any; // type helper noop
      const hit: AppleDocHit = { symbol, framework, kind, id, summary, snippet, url, path: m.path, takeaways: [] };
      // try to add topics when available (only for JSON case above)
      if (m.path.endsWith(".json")) {
        const txt2 = await readFile(m.path, "utf8");
        try {
          const js2 = JSON.parse(txt2);
          const tlist = extractTopics(js2);
          if (tlist && tlist.length) hit.topics = tlist;
        } catch {}
      }
      out.push(hit);
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
