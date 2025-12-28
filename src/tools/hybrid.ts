import { z } from "zod";
import { loadUnifiedIndex, buildUnifiedIndex } from "../utils/hybrid_index.js";

export const HybridSearchSchema = z.object({
  query: z.string(),
  sources: z.array(z.enum(["apple", "hig", "pattern", "tspl", "recipe"]).default("apple")).optional(),
  frameworks: z.array(z.string()).optional(),
  kinds: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional(),
});

export type HybridSearchInput = z.infer<typeof HybridSearchSchema>;

export async function hybridSearch({ query, sources, frameworks, kinds, topics, tags, limit = 10 }: HybridSearchInput) {
  const use = new Set(sources && sources.length ? sources : ["apple", "hig", "pattern", "tspl", "recipe"]);
  const results: any[] = [];

  // Unified index (preferred)
  try {
    let mini = await loadUnifiedIndex();
    if (!mini) mini = (await buildUnifiedIndex())?.index ?? null;
    if (mini) {
      let hits = (mini.search(query, { prefix: true, fuzzy: 0.1 }) as any[]);
      // Apply filters across unified docs
      if (sources?.length) hits = hits.filter((h) => sources.includes(h.source));
      if (frameworks?.length) hits = hits.filter((h) => h.framework && frameworks.includes(h.framework));
      if (kinds?.length) hits = hits.filter((h) => h.kind && kinds.includes(h.kind));
      if (topics?.length) hits = hits.filter((h) => (h.topics || []).some((t: string) => topics.includes(t)));
      if (tags?.length) hits = hits.filter((h) => (h.tags || []).some((t: string) => tags.includes(t)));

      // Deduplicate by id/url/symbol - same doc can exist at different paths
      const seen = new Set<string>();
      for (const h of hits) {
        // Prefer id or url for dedup (stable across different cache paths)
        // Fall back to normalized symbol/title
        const symbolKey = (h.symbol || h.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const key = h.id || h.url || `${h.source}|${symbolKey}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(h);
        if (results.length >= limit * 2) break; // get extras for sorting
      }
    }
  } catch {}

  // Simple cross-source ranking: prefer exact title/symbol match, then by stored score if present
  const nq = query.toLowerCase();
  results.sort((a, b) => {
    const aExact = (a.symbol || a.title || "").toLowerCase() === nq ? 1 : 0;
    const bExact = (b.symbol || b.title || "").toLowerCase() === nq ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    const as = typeof a.score === "number" ? a.score : 0;
    const bs = typeof b.score === "number" ? b.score : 0;
    return bs - as;
  });

  const limited = results.slice(0, limit);
  // Facets with counts and sorted
  const countMap = (vals: (string | undefined)[]) => {
    const m = new Map<string, number>();
    for (const v of vals) if (v) m.set(v, (m.get(v) || 0) + 1);
    return Array.from(m.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
  };
  const countMulti = (lists: (string[] | undefined)[]) => {
    const m = new Map<string, number>();
    for (const arr of lists) for (const v of arr || []) m.set(v, (m.get(v) || 0) + 1);
    return Array.from(m.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
  };
  const facets = {
    sources: countMap(limited.map((r) => r.source)),
    frameworks: countMap(limited.map((r) => r.framework)),
    kinds: countMap(limited.map((r) => r.kind)),
    topics: countMulti(limited.map((r) => r.topics)),
    tags: countMulti(limited.map((r) => r.tags)),
  };
  return { results: limited, facets };
}
