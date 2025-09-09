import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileText } from "./cache.js";
import YAML from "yaml";

export function stripHtml(input: string): string {
  return input.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export async function readYamlFile<T = any>(path: string): Promise<T | null> {
  try {
    const txt = await fileText(path);
    return YAML.parse(txt) as T;
  } catch {
    return null;
  }
}

export async function loadYamlDir<T = any>(dir: string, patterns: string[] = ["**/*.y?(a)ml"]): Promise<Array<{ path: string; data: T }>> {
  const files = await fg(patterns, { cwd: dir, absolute: true });
  const out: Array<{ path: string; data: T }> = [];
  for (const f of files) {
    const data = await readYamlFile<T>(f);
    if (data) out.push({ path: f, data });
  }
  return out;
}

export async function searchInFiles(base: string, patterns: string[], query: string, limit = 5): Promise<Array<{ path: string; excerpt: string }>> {
  const files = await fg(patterns, { cwd: base, absolute: true, dot: true });
  const lc = query.toLowerCase();
  const results: Array<{ path: string; excerpt: string }> = [];
  for (const f of files) {
    try {
      const text = await readFile(f, "utf8");
      const plain = f.endsWith(".html") ? stripHtml(text) : text;
      const idx = plain.toLowerCase().indexOf(lc);
      if (idx !== -1) {
        const start = Math.max(0, idx - 200);
        const end = Math.min(plain.length, idx + 200);
        const excerpt = plain.slice(start, end).replace(/\s+/g, " ").trim();
        results.push({ path: f, excerpt });
        if (results.length >= limit) break;
      }
    } catch {
      // ignore unreadable file
    }
  }
  return results;
}

