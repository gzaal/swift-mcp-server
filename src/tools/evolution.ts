import { join, basename } from "node:path";
import { getCacheDir, searchFiles, fileText } from "../utils/cache.js";

export type EvolutionLookupInput = { query: string; limit?: number };

export async function evolutionLookup({ query, limit = 5 }: EvolutionLookupInput) {
  const base = join(getCacheDir(), "swift-evolution", "proposals");
  const results: any[] = [];

  // If looks like SE-####, search exact
  const m = query.trim().match(/SE[-\s]?\d{4}/i);
  if (m) {
    const id = m[0].toUpperCase().replace(/\s+/, "-");
    const matches = await searchFiles(base, ["**/*.md"], id, limit);
    for (const r of matches) {
      const text = await fileText(r.path);
      const title = (text.match(/^#\s+(.+)$/m) || [])[1] || basename(r.path);
      const status = (text.match(/^\s*Status:\s*(.+)$/mi) || [])[1] || "Unknown";
      results.push({ id, title, status, path: r.path });
    }
    if (results.length > 0) return results.slice(0, limit);
  }

  // Otherwise fuzzy by filename/title
  const matches = await searchFiles(base, ["**/*.md"], query, limit * 2);
  for (const r of matches) {
    const text = await fileText(r.path);
    const id = (text.match(/^\s*SE-\d{4}/mi) || [])[0] || basename(r.path).slice(0, 9);
    const title = (text.match(/^#\s+(.+)$/m) || [])[1] || basename(r.path);
    const status = (text.match(/^\s*Status:\s*(.+)$/mi) || [])[1] || "Unknown";
    results.push({ id, title, status, path: r.path });
    if (results.length >= (limit || 5)) break;
  }

  return results.slice(0, limit);
}

