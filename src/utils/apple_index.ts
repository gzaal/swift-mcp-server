import MiniSearch from "minisearch";
import fg from "fast-glob";
import { join } from "node:path";
import { getCacheDir, pathExists } from "./cache.js";
import { parseAppleDocAtPath, AppleDocHit } from "../tools/apple_docs.js";

export type AppleDocRecord = AppleDocHit & { _id: string; source: "apple" };

function miniOptions() {
  return {
    fields: ["symbol", "summary", "snippet", "framework", "kind", "topics"],
    storeFields: ["_id", "symbol", "framework", "kind", "summary", "snippet", "url", "topics", "path", "id", "source"],
    searchOptions: {
      boost: { symbol: 5, framework: 2, kind: 1 },
      fuzzy: 0.1,
      prefix: true,
    },
  };
}

export async function buildAppleDocsIndex(): Promise<{ index: MiniSearch; count: number } | null> {
  const base = join(getCacheDir(), "apple-docs");
  if (!(await pathExists(base))) return null;
  const files = await fg(["**/*.json", "**/*.md", "**/*.markdown", "**/*.html"], { cwd: base, absolute: true });
  const docs: AppleDocRecord[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const hit = await parseAppleDocAtPath(f);
    if (!hit || !hit.symbol) continue;
    const key = `${(hit.framework || "").toLowerCase()}|${(hit.id || hit.symbol).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    docs.push({ ...hit, _id: key, source: "apple" });
  }
  if (docs.length === 0) return null;
  const mini = new MiniSearch<AppleDocRecord>(miniOptions());
  mini.addAll(docs);
  return { index: mini, count: docs.length };
}

export async function saveAppleDocsIndex(mini: MiniSearch): Promise<string> {
  const dir = join(getCacheDir(), "index");
  await (await import("node:fs/promises")).mkdir(dir, { recursive: true });
  const p = join(dir, "apple-docs.json");
  await (await import("node:fs/promises")).writeFile(p, JSON.stringify(mini.toJSON()), "utf8");
  return p;
}

export async function loadAppleDocsIndex(): Promise<MiniSearch | null> {
  const p = join(getCacheDir(), "index", "apple-docs.json");
  try {
    const txt = await (await import("node:fs/promises")).readFile(p, "utf8");
    const mini = MiniSearch.loadJSON(txt, miniOptions());
    return mini;
  } catch {
    return null;
  }
}
