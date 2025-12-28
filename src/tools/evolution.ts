import { join, basename } from "node:path";
import { getCacheDir, searchFiles, fileText } from "../utils/cache.js";

export type EvolutionLookupInput = { query: string; limit?: number };

/**
 * Extract proposal ID from filename (e.g., "0001-keywords-as-argument-labels.md" -> "SE-0001")
 */
function extractProposalId(filename: string): string {
  const match = filename.match(/^(\d{4})-/);
  if (match) return `SE-${match[1]}`;
  return filename.slice(0, 7);
}

/**
 * Parse status from proposal markdown.
 * Format: `* Status: **Implemented (Swift 2.2)**` or `* Status: **Accepted**`
 */
function extractStatus(text: string): string {
  // Match: * Status: **Status Text** or * Status: **Status (version)**
  const match = text.match(/^\*\s*Status:\s*\*\*(.+?)\*\*/m);
  if (match) return match[1].trim();
  // Fallback: plain Status: line
  const fallback = text.match(/^\s*Status:\s*(.+)$/mi);
  if (fallback) return fallback[1].replace(/\*+/g, "").trim();
  return "Unknown";
}

export async function evolutionLookup({ query, limit = 5 }: EvolutionLookupInput) {
  const base = join(getCacheDir(), "swift-evolution", "proposals");
  const results: any[] = [];

  // If looks like SE-####, search exact
  const m = query.trim().match(/SE[-\s]?(\d{4})/i);
  if (m) {
    const id = `SE-${m[1]}`;
    const matches = await searchFiles(base, ["**/*.md"], m[1], limit);
    for (const r of matches) {
      const text = await fileText(r.path);
      const title = (text.match(/^#\s+(.+)$/m) || [])[1] || basename(r.path);
      const status = extractStatus(text);
      results.push({ id, title, status, path: r.path });
    }
    if (results.length > 0) return results.slice(0, limit);
  }

  // Otherwise fuzzy by filename/title
  const matches = await searchFiles(base, ["**/*.md"], query, limit * 2);
  for (const r of matches) {
    const text = await fileText(r.path);
    const filename = basename(r.path);
    const id = extractProposalId(filename);
    const title = (text.match(/^#\s+(.+)$/m) || [])[1] || filename;
    const status = extractStatus(text);
    results.push({ id, title, status, path: r.path });
    if (results.length >= (limit || 5)) break;
  }

  return results.slice(0, limit);
}

