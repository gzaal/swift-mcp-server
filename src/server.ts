import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { docsSearch } from "./tools/docs.js";
import { evolutionLookup } from "./tools/evolution.js";
import { lintRun } from "./tools/lint.js";
import { formatApply } from "./tools/format.js";
import { guidelinesCheck } from "./tools/guidelines.js";
import { updateSync } from "./tools/update.js";
import { appleDocsSearch, swiftSymbolLookup } from "./tools/apple_docs.js";
import { cocoaPatternsSearch } from "./tools/patterns.js";
import { higSearch } from "./tools/hig.js";
import { hybridSearch } from "./tools/hybrid.js";

const mcp = new McpServer({ name: "swift-mcp-server", version: "0.1.0" });

mcp.registerTool(
  "swift_docs_search",
  {
    description: "Search Swift docs (TSPL + API Design Guidelines)",
    inputSchema: { query: z.string(), limit: z.number().optional() },
  },
  async ({ query, limit }) => {
    const results = await docsSearch({ query, limit });
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

mcp.registerTool(
  "swift_evolution_lookup",
  {
    description: "Lookup Swift Evolution proposals by ID or keyword",
    inputSchema: { query: z.string(), limit: z.number().optional() },
  },
  async ({ query, limit }) => {
    const results = await evolutionLookup({ query, limit });
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

mcp.registerTool(
  "swift_lint_run",
  {
    description: "Run SwiftLint on a path",
    inputSchema: { path: z.string().optional(), configPath: z.string().optional(), strict: z.boolean().optional() },
  },
  async ({ path, configPath, strict }) => {
    const res = await lintRun({ path, configPath, strict });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

mcp.registerTool(
  "swift_format_apply",
  {
    description: "Format Swift code using swift-format or SwiftFormat",
    inputSchema: { code: z.string(), swiftVersion: z.string().optional(), assumeFilepath: z.string().optional() },
  },
  async ({ code, swiftVersion, assumeFilepath }) => {
    const res = await formatApply({ code, swiftVersion, assumeFilepath });
    if (res.ok) {
      return { content: [{ type: "text", text: res.formatted ?? "" }] };
    } else {
      return { content: [{ type: "text", text: res.message ?? "Formatting failed" }] };
    }
  }
);

mcp.registerTool(
  "swift_guidelines_check",
  {
    description: "Run heuristic Swift API Guidelines checks on code",
    inputSchema: { code: z.string() },
  },
  async ({ code }) => {
    const res = await guidelinesCheck({ code });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

mcp.registerTool(
  "swift_update_sync",
  {
    description: "Mirror swift-evolution and swift-book into .cache for offline queries",
    inputSchema: {},
  },
  async () => {
    const msg = await updateSync();
    return { content: [{ type: "text", text: msg }] };
  }
);

// Apple docs search
mcp.registerTool(
  "apple_docs_search",
  {
    description: "Search Apple docs (DocC/docsets). Filters by frameworks optionally.",
    inputSchema: { query: z.string(), frameworks: z.array(z.string()).optional(), kinds: z.array(z.string()).optional(), topics: z.array(z.string()).optional(), limit: z.number().optional() },
  },
  async ({ query, frameworks, kinds, topics, limit }) => {
    const results = await appleDocsSearch({ query, frameworks, kinds, topics, limit });
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

// Cocoa patterns
mcp.registerTool(
  "cocoa_patterns_search",
  {
    description: "Search curated Cocoa patterns (keyboard/focus/window).",
    inputSchema: { queryOrTag: z.string(), limit: z.number().optional() },
  },
  async ({ queryOrTag, limit }) => {
    const results = await cocoaPatternsSearch({ queryOrTag, limit });
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

// HIG search
mcp.registerTool(
  "hig_search",
  {
    description: "Search macOS HIG snapshots (local cache).",
    inputSchema: { query: z.string(), limit: z.number().optional() },
  },
  async ({ query, limit }) => {
    const results = await higSearch({ query, limit });
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

// Symbol lookup
mcp.registerTool(
  "swift_symbol_lookup",
  {
    description: "Resolve a Swift symbol/selector to Apple docs hits.",
    inputSchema: { symbolOrSelector: z.string() },
  },
  async ({ symbolOrSelector }) => {
    const results = await swiftSymbolLookup(symbolOrSelector);
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

// Hybrid search across Apple docs, HIG, and patterns
mcp.registerTool(
  "search_hybrid",
  {
    description: "Hybrid search across Apple DocC, HIG, and curated patterns with facet filters.",
    inputSchema: {
      query: z.string(),
      sources: z.array(z.enum(["apple", "hig", "pattern"]).default("apple")).optional(),
      frameworks: z.array(z.string()).optional(),
      kinds: z.array(z.string()).optional(),
      topics: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      limit: z.number().optional(),
    },
  },
  async (input) => {
    const payload = await hybridSearch(input as any);
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await mcp.connect(transport);
