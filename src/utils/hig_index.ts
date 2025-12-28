import MiniSearch from "minisearch";
import fg from "fast-glob";
import { join } from "node:path";
import { CACHE_DIR } from "./cache.js";
import { readFile } from "node:fs/promises";
import { stripHtml } from "./index.js";

export type HigRecord = {
  _id: string;
  source: "hig";
  title?: string;
  summary?: string;
  section?: string;
  url?: string;
  path: string;
};

function parseHigHtml(html: string): { title?: string; url?: string; text: string } {
  const mTitle = html.match(/<title>(.*?)<\/title>/i);
  const title = mTitle ? mTitle[1].replace(/\s+/g, " ").trim() : undefined;
  const mCanon = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const url = mCanon ? mCanon[1] : undefined;
  return { title, url, text: stripHtml(html) };
}

export async function buildHigIndex(base = join(CACHE_DIR, "hig")): Promise<{ index: MiniSearch; count: number } | null> {
  const files = await fg(["**/*.html", "**/*.md", "**/*.markdown"], { cwd: base, absolute: true });
  if (files.length === 0) return null;
  const docs: HigRecord[] = [];
  for (const f of files) {
    try {
      const txt = await readFile(f, "utf8");
      let title: string | undefined;
      let url: string | undefined;
      let summary: string | undefined;
      if (f.endsWith(".html")) {
        const parsed = parseHigHtml(txt);
        title = parsed.title;
        url = parsed.url;
        const t = parsed.text;
        summary = t.slice(0, 400);
      } else {
        summary = txt.slice(0, 400);
      }
      const rec: HigRecord = { _id: f, source: "hig", title, summary, path: f, url };
      docs.push(rec);
    } catch {
      // ignore
    }
  }
  if (docs.length === 0) return null;
  const mini = new MiniSearch<HigRecord>({
    idField: "_id",
    fields: ["title", "summary"],
    storeFields: ["_id", "title", "summary", "url", "path", "source"],
    searchOptions: { boost: { title: 3 }, fuzzy: 0.1, prefix: true },
  });
  mini.addAll(docs);
  return { index: mini, count: docs.length };
}

export async function saveHigIndex(mini: MiniSearch): Promise<string> {
  const dir = join(CACHE_DIR, "index");
  await (await import("node:fs/promises")).mkdir(dir, { recursive: true });
  const p = join(dir, "hig.json");
  await (await import("node:fs/promises")).writeFile(p, JSON.stringify(mini.toJSON()), "utf8");
  return p;
}

export async function loadHigIndex(): Promise<MiniSearch | null> {
  const p = join(CACHE_DIR, "index", "hig.json");
  try {
    const txt = await (await import("node:fs/promises")).readFile(p, "utf8");
    const mini = MiniSearch.loadJSON(txt, { idField: "_id", fields: ["title", "summary"], storeFields: ["_id", "title", "summary", "url", "path", "source"] });
    return mini;
  } catch {
    return null;
  }
}
