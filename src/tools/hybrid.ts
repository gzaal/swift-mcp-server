import { z } from "zod";
import { loadAppleDocsIndex, buildAppleDocsIndex } from "../utils/apple_index.js";
import { loadHigIndex, buildHigIndex } from "../utils/hig_index.js";
import { loadPatternsIndex, buildPatternsIndex } from "../utils/patterns_index.js";

export const HybridSearchSchema = z.object({
  query: z.string(),
  sources: z.array(z.enum(["apple", "hig", "pattern"]).default("apple")).optional(),
  frameworks: z.array(z.string()).optional(),
  kinds: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional(),
});

export type HybridSearchInput = z.infer<typeof HybridSearchSchema>;

export async function hybridSearch({ query, sources, frameworks, kinds, topics, tags, limit = 10 }: HybridSearchInput) {
  const use = new Set(sources && sources.length ? sources : ["apple", "hig", "pattern"]);
  const results: any[] = [];

  // Apple docs
  if (use.has("apple")) {
    try {
      let mini = await loadAppleDocsIndex();
      if (!mini) mini = (await buildAppleDocsIndex())?.index ?? null;
      if (mini) {
        let hits = (mini.search(query, { prefix: true, fuzzy: 0.1 }) as any[]).map((r) => ({ ...r, source: "apple" }));
        if (frameworks?.length) hits = hits.filter((h) => h.framework && frameworks.includes(h.framework));
        if (kinds?.length) hits = hits.filter((h) => h.kind && kinds.includes(h.kind));
        if (topics?.length) hits = hits.filter((h) => (h.topics || []).some((t: string) => topics.includes(t)));
        results.push(...hits.slice(0, limit));
      }
    } catch {}
  }

  // HIG
  if (use.has("hig")) {
    try {
      let mini = await loadHigIndex();
      if (!mini) mini = (await buildHigIndex())?.index ?? null;
      if (mini) {
        const hits = (mini.search(query, { prefix: true, fuzzy: 0.1 }) as any[]).map((r) => ({ ...r, source: "hig" }));
        results.push(...hits.slice(0, limit));
      }
    } catch {}
  }

  // Patterns
  if (use.has("pattern")) {
    try {
      let mini = await loadPatternsIndex();
      if (!mini) mini = (await buildPatternsIndex())?.index ?? null;
      if (mini) {
        let hits = (mini.search(query, { prefix: true, fuzzy: 0.1 }) as any[]).map((r) => ({ ...r, source: "pattern" }));
        if (tags?.length) hits = hits.filter((h) => (h.tags || []).some((t: string) => tags.includes(t)));
        results.push(...hits.slice(0, limit));
      }
    } catch {}
  }

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
  // Facets
  const facet = <T>(vals: (T | undefined | null)[]) => Array.from(new Set(vals.filter(Boolean) as T[]));
  const facets = {
    sources: facet(limited.map((r) => r.source)),
    frameworks: facet(limited.map((r) => r.framework)),
    kinds: facet(limited.map((r) => r.kind)),
    topics: facet(limited.flatMap((r) => (r.topics ?? []) as string[])),
    tags: facet(limited.flatMap((r) => (r.tags ?? []) as string[])),
  };
  return { results: limited, facets };
}
