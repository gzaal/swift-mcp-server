import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import fg from "fast-glob";

export const CACHE_DIR = resolve(process.cwd(), ".cache");

export async function ensureCacheDir(sub?: string): Promise<string> {
  const dir = sub ? join(CACHE_DIR, sub) : CACHE_DIR;
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function fileText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function writeText(path: string, content: string): Promise<void> {
  await writeFile(path, content, "utf8");
}

export async function pathExists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

export async function searchFiles(
  base: string,
  patterns: string[],
  query: string,
  limit = 5
): Promise<Array<{ path: string; excerpt: string }>> {
  const files = await fg(patterns, { cwd: base, absolute: true, dot: true });
  const lc = query.toLowerCase();
  const results: Array<{ path: string; excerpt: string }> = [];
  for (const f of files) {
    try {
      const text = await fileText(f);
      const idx = text.toLowerCase().indexOf(lc);
      if (idx !== -1) {
        const start = Math.max(0, idx - 200);
        const end = Math.min(text.length, idx + 200);
        const excerpt = text.slice(start, end).replace(/\s+/g, " ").trim();
        results.push({ path: f, excerpt });
        if (results.length >= limit) break;
      }
    } catch {
      // ignore
    }
  }
  return results;
}

