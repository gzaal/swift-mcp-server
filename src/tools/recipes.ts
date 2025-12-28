import { join, resolve } from "node:path";
import { getCacheDir, pathExists } from "../utils/cache.js";
import { loadYamlDir } from "../utils/index.js";

export type Recipe = {
  id: string;
  title: string;
  tags?: string[];
  summary?: string;
  steps?: string[];
  snippet?: string;
  prerequisites?: string[];
  references?: string[];
};

export type RecipeLookupInput = { queryOrId: string; limit?: number };

export async function swiftRecipeLookup({ queryOrId, limit = 5 }: RecipeLookupInput): Promise<Recipe[]> {
  const repoDir = resolve(process.cwd(), "content", "recipes");
  const cacheDir = join(getCacheDir(), "content", "recipes");
  const dirs: string[] = [];
  if (await pathExists(repoDir)) dirs.push(repoDir);
  if (await pathExists(cacheDir)) dirs.push(cacheDir);
  if (dirs.length === 0) return [];
  const filesArr = await Promise.all(dirs.map((d) => loadYamlDir<Recipe | Recipe[]>(d)));
  const files = filesArr.flat();
  const q = queryOrId.toLowerCase();
  const out: Recipe[] = [];
  for (const f of files) {
    const list = Array.isArray(f.data) ? f.data : [f.data];
    for (const r of list) {
      if (!r) continue;
      if (r.id?.toLowerCase() === q) {
        out.push(r);
      } else {
        const hay = `${r.title} ${r.summary ?? ""} ${(r.tags ?? []).join(" ")} ${(r.steps ?? []).join(" ")}`.toLowerCase();
        if (hay.includes(q)) out.push(r);
      }
      if (out.length >= limit) break;
    }
    if (out.length >= limit) break;
  }
  return out;
}

