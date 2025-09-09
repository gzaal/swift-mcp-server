import { join } from "node:path";
import { CACHE_DIR, pathExists } from "../utils/cache.js";
import { searchInFiles } from "../utils/index.js";
import { readFile } from "node:fs/promises";

export type HigSearchInput = { query: string; limit?: number };

export type HigHit = { title?: string; section?: string; summary?: string; url?: string; path: string };

export async function higSearch({ query, limit = 5 }: HigSearchInput): Promise<HigHit[]> {
  const base = join(CACHE_DIR, "hig");
  const exists = await pathExists(base);
  if (!exists) return [];
  const matches = await searchInFiles(base, ["**/*.html", "**/*.md", "**/*.markdown"], query, limit * 3);
  const out: HigHit[] = [];
  for (const m of matches) {
    let title: string | undefined;
    let url: string | undefined;
    try {
      if (m.path.endsWith(".html")) {
        const txt = await readFile(m.path, "utf8");
        const mTitle = txt.match(/<title>(.*?)<\/title>/i);
        if (mTitle) title = mTitle[1].replace(/\s+/g, " ").trim();
        const mCanon = txt.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
        if (mCanon) url = mCanon[1];
      }
    } catch {
      // ignore
    }
    out.push({ title, summary: m.excerpt, url, path: m.path });
    if (out.length >= limit) break;
  }
  return out;
}

