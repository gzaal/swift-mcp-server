import MiniSearch from "minisearch";
import fg from "fast-glob";
import { join } from "node:path";
import { CACHE_DIR } from "./cache.js";
import { readFile } from "node:fs/promises";
import { stripHtml, loadYamlDir } from "./index.js";
import { parseAppleDocAtPath } from "../tools/apple_docs.js";
import { parseTSPLFiles, type TSPLRecord } from "./tspl_index.js";

export type UnifiedRecord = {
  _id: string;
  source: "apple" | "hig" | "pattern" | "recipe" | "tspl";
  symbol?: string; // for Apple
  title?: string; // for HIG/Patterns/TSPL
  chapter?: string; // for TSPL
  section?: string; // for TSPL
  framework?: string;
  kind?: string;
  topics?: string[];
  tags?: string[];
  summary?: string;
  snippet?: string;
  url?: string;
  path: string;
  id?: string;
};

export async function buildUnifiedIndex(): Promise<{ index: MiniSearch; count: number } | null> {
  const docs: UnifiedRecord[] = [];

  // Apple DocC
  const appleBase = join(CACHE_DIR, "apple-docs");
  try {
    const appleFiles = await fg(["**/*.json", "**/*.md", "**/*.markdown", "**/*.html"], { cwd: appleBase, absolute: true });
    const seen = new Set<string>();
    for (const f of appleFiles) {
      const hit = await parseAppleDocAtPath(f);
      if (!hit) continue;
      const key = `apple|${(hit.framework || "").toLowerCase()}|${(hit.id || hit.symbol || hit.path || f).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      docs.push({
        _id: key,
        source: "apple",
        symbol: hit.symbol,
        framework: hit.framework,
        kind: hit.kind,
        topics: hit.topics,
        summary: hit.summary,
        snippet: hit.snippet,
        url: hit.url,
        path: hit.path || f,
        id: hit.id,
      });
    }
  } catch {}

  // HIG
  const higBase = join(CACHE_DIR, "hig");
  try {
    const files = await fg(["**/*.html", "**/*.md", "**/*.markdown"], { cwd: higBase, absolute: true });
    for (const f of files) {
      try {
        const html = await readFile(f, "utf8");
        const mTitle = html.match(/<title>(.*?)<\/title>/i);
        const title = mTitle ? mTitle[1].replace(/\s+/g, " ").trim() : undefined;
        const mCanon = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
        const url = mCanon ? mCanon[1] : undefined;
        const summary = stripHtml(html).slice(0, 400);
        docs.push({ _id: `hig|${f}`, source: "hig", title, summary, url, path: f });
      } catch {}
    }
  } catch {}

  // Patterns
  try {
    const pattDirs = [join(CACHE_DIR, "content", "patterns"), join(process.cwd(), "content", "patterns")];
    for (const dir of pattDirs) {
      const yml = await loadYamlDir<any>(dir);
      for (const file of yml) {
        const list = Array.isArray(file.data) ? file.data : [file.data];
        for (const p of list) {
          if (!p?.id || !p?.title) continue;
          docs.push({ _id: `pattern|${file.path}#${p.id}`, source: "pattern", title: p.title, tags: p.tags || [], summary: p.summary, snippet: p.snippet, path: file.path });
        }
      }
    }
  } catch {}

  // Recipes
  try {
    const recipeDirs = [join(CACHE_DIR, "content", "recipes"), join(process.cwd(), "content", "recipes")];
    for (const dir of recipeDirs) {
      const yml = await loadYamlDir<any>(dir);
      for (const file of yml) {
        const list = Array.isArray(file.data) ? file.data : [file.data];
        for (const r of list) {
          if (!r?.id || !r?.title) continue;
          docs.push({ _id: `recipe|${file.path}#${r.id}`, source: "recipe", title: r.title, tags: r.tags || [], summary: r.summary, snippet: r.snippet, path: file.path });
        }
      }
    }
  } catch {}

  // TSPL (Swift Programming Language book)
  try {
    const tsplRecords = await parseTSPLFiles();
    for (const rec of tsplRecords) {
      docs.push({
        _id: rec._id,
        source: "tspl",
        title: rec.title,
        chapter: rec.chapter,
        section: rec.section,
        summary: rec.summary,
        snippet: rec.snippet,
        url: rec.url,
        path: rec.path,
      });
    }
  } catch {}

  if (docs.length === 0) return null;
  const mini = new MiniSearch<UnifiedRecord>({
    idField: "_id",
    fields: ["symbol", "title", "summary", "snippet", "framework", "kind", "topics", "tags", "chapter", "section"],
    storeFields: ["_id", "source", "symbol", "title", "framework", "kind", "topics", "tags", "summary", "snippet", "url", "path", "id", "chapter", "section"],
    searchOptions: { boost: { symbol: 5, title: 4, chapter: 3, framework: 2, kind: 1 }, prefix: true, fuzzy: 0.1 },
  });
  mini.addAll(docs);
  return { index: mini, count: docs.length };
}

export async function saveUnifiedIndex(mini: MiniSearch): Promise<string> {
  const dir = join(CACHE_DIR, "index");
  await (await import("node:fs/promises")).mkdir(dir, { recursive: true });
  const p = join(dir, "hybrid.json");
  await (await import("node:fs/promises")).writeFile(p, JSON.stringify(mini.toJSON()), "utf8");
  return p;
}

export async function loadUnifiedIndex(): Promise<MiniSearch | null> {
  const p = join(CACHE_DIR, "index", "hybrid.json");
  try {
    const txt = await (await import("node:fs/promises")).readFile(p, "utf8");
    const mini = MiniSearch.loadJSON(txt, {
      idField: "_id",
      fields: ["symbol", "title", "summary", "snippet", "framework", "kind", "topics", "tags", "chapter", "section"],
      storeFields: ["_id", "source", "symbol", "title", "framework", "kind", "topics", "tags", "summary", "snippet", "url", "path", "id", "chapter", "section"],
      searchOptions: { boost: { symbol: 5, title: 4, chapter: 3, framework: 2, kind: 1 }, prefix: true, fuzzy: 0.1 },
    });
    return mini;
  } catch {
    return null;
  }
}
