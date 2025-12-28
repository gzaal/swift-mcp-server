import { join } from "node:path";
import { stat, readFile } from "node:fs/promises";
import { CACHE_DIR, pathExists } from "../utils/cache.js";

type IndexInfo = {
  path: string;
  exists: boolean;
  sizeBytes?: number;
  mtime?: string;
  documentCount?: number;
};

async function fileInfo(p: string): Promise<{ sizeBytes?: number; mtime?: string } | {}> {
  try {
    const s = await stat(p);
    return { sizeBytes: s.size, mtime: s.mtime.toISOString() };
  } catch {
    return {};
  }
}

async function indexInfo(relPath: string): Promise<IndexInfo> {
  const p = join(CACHE_DIR, "index", relPath);
  const exists = await pathExists(p);
  const info: IndexInfo = { path: p, exists };
  if (exists) {
    Object.assign(info, await fileInfo(p));
    try {
      const txt = await readFile(p, "utf8");
      const js = JSON.parse(txt);
      if (typeof js.documentCount === "number") info.documentCount = js.documentCount;
    } catch {
      // ignore parse errors
    }
  }
  return info;
}

export async function indexStatus() {
  const apple = await indexInfo("apple-docs.json");
  const hig = await indexInfo("hig.json");
  const patterns = await indexInfo("patterns.json");
  const hybrid = await indexInfo("hybrid.json");
  return {
    cacheDir: CACHE_DIR,
    indexes: { apple, hig, patterns, hybrid },
  };
}

