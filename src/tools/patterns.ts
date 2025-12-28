import { join, resolve } from "node:path";
import { getCacheDir, pathExists } from "../utils/cache.js";
import { loadYamlDir } from "../utils/index.js";

export type Pattern = {
  id: string;
  title: string;
  tags?: string[];
  summary?: string;
  snippet?: string;
  takeaways?: string[];
};

export type CocoaPatternsSearchInput = { queryOrTag: string; limit?: number };

export async function cocoaPatternsSearch({ queryOrTag, limit = 5 }: CocoaPatternsSearchInput): Promise<Pattern[]> {
  const cacheDir = join(getCacheDir(), "content", "patterns");
  const repoDir = resolve(process.cwd(), "content", "patterns");
  const dirs: string[] = [];
  if (await pathExists(repoDir)) dirs.push(repoDir);
  if (await pathExists(cacheDir)) dirs.push(cacheDir);
  if (dirs.length === 0) return [];
  const filesArr = await Promise.all(dirs.map((d) => loadYamlDir<Pattern | Pattern[]>(d)));
  const files = filesArr.flat();
  const q = queryOrTag.toLowerCase();
  const out: Pattern[] = [];
  for (const f of files) {
    const list = Array.isArray(f.data) ? f.data : [f.data];
    for (const p of list) {
      const hay = `${p.title} ${p.summary ?? ""} ${p.snippet ?? ""} ${(p.tags ?? []).join(" ")}`.toLowerCase();
      const match = hay.includes(q) || (p.tags ?? []).map((t) => t.toLowerCase()).includes(q);
      if (match) {
        out.push({ id: p.id, title: p.title, tags: p.tags, summary: p.summary, snippet: p.snippet, takeaways: p.takeaways });
        if (out.length >= limit) break;
      }
    }
    if (out.length >= limit) break;
  }
  return out;
}
