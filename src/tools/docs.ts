import { join } from "node:path";
import { getCacheDir, searchFiles, fileText } from "../utils/cache.js";

export type DocsSearchInput = { query: string; limit?: number };

export async function docsSearch({ query, limit = 5 }: DocsSearchInput) {
  const cacheDir = getCacheDir();
  const results: any[] = [];
  const tsplBase = join(cacheDir, "swift-book");
  const tspl = await searchFiles(tsplBase, ["**/*.md", "**/*.markdown", "**/*.mdx", "**/*.rst"], query, limit);
  for (const r of tspl) {
    results.push({ source: "TSPL", path: r.path, excerpt: r.excerpt });
  }

  // API Design Guidelines (HTML cached)
  const guidelinesHtml = join(cacheDir, "guidelines", "api-design-guidelines.html");
  try {
    const html = await fileText(guidelinesHtml);
    const idx = html.toLowerCase().indexOf(query.toLowerCase());
    if (idx !== -1) {
      const start = Math.max(0, idx - 200);
      const end = Math.min(html.length, idx + 200);
      const excerpt = html.slice(start, end).replace(/\s+/g, " ").replace(/<[^>]+>/g, "").trim();
      results.unshift({ source: "API Design Guidelines", path: guidelinesHtml, excerpt });
    }
  } catch {
    // ignore
  }

  return results.slice(0, limit);
}

