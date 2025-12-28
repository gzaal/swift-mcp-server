import MiniSearch from "minisearch";
import { join, resolve } from "node:path";
import { getCacheDir, pathExists } from "./cache.js";
import { loadYamlDir } from "./index.js";

export type PatternRec = {
  _id: string;
  source: "pattern";
  id: string;
  title: string;
  tags?: string[];
  summary?: string;
  snippet?: string;
  takeaways?: string[];
  path: string;
};

export async function buildPatternsIndex(): Promise<{ index: MiniSearch; count: number } | null> {
  const repoDir = resolve(process.cwd(), "content", "patterns");
  const cacheDir = join(getCacheDir(), "content", "patterns");
  const dirs: string[] = [];
  if (await pathExists(repoDir)) dirs.push(repoDir);
  if (await pathExists(cacheDir)) dirs.push(cacheDir);
  if (dirs.length === 0) return null;
  const docs: PatternRec[] = [];
  for (const d of dirs) {
    const files = await loadYamlDir<any>(d);
    for (const f of files) {
      const list = Array.isArray(f.data) ? f.data : [f.data];
      for (const p of list) {
        if (!p?.id || !p?.title) continue;
        docs.push({
          _id: `${f.path}#${p.id}`,
          source: "pattern",
          id: String(p.id),
          title: String(p.title),
          tags: p.tags || [],
          summary: p.summary,
          snippet: p.snippet,
          takeaways: p.takeaways,
          path: f.path,
        });
      }
    }
  }
  if (docs.length === 0) return null;
  const mini = new MiniSearch<PatternRec>({
    fields: ["title", "summary", "snippet", "tags"],
    storeFields: ["_id", "id", "title", "tags", "summary", "snippet", "takeaways", "path", "source"],
    searchOptions: { boost: { title: 3, tags: 2 }, fuzzy: 0.1, prefix: true },
  });
  mini.addAll(docs);
  return { index: mini, count: docs.length };
}

export async function savePatternsIndex(mini: MiniSearch): Promise<string> {
  const dir = join(getCacheDir(), "index");
  await (await import("node:fs/promises")).mkdir(dir, { recursive: true });
  const p = join(dir, "patterns.json");
  await (await import("node:fs/promises")).writeFile(p, JSON.stringify(mini.toJSON()), "utf8");
  return p;
}

export async function loadPatternsIndex(): Promise<MiniSearch | null> {
  const p = join(getCacheDir(), "index", "patterns.json");
  try {
    const txt = await (await import("node:fs/promises")).readFile(p, "utf8");
    const mini = MiniSearch.loadJSON(txt, { fields: ["title", "summary", "snippet", "tags"], storeFields: ["_id", "id", "title", "tags", "summary", "snippet", "takeaways", "path", "source"] });
    return mini;
  } catch {
    return null;
  }
}
