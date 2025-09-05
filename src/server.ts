import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { docsSearch } from "./tools/docs.js";
import { evolutionLookup } from "./tools/evolution.js";
import { lintRun } from "./tools/lint.js";
import { formatApply } from "./tools/format.js";
import { guidelinesCheck } from "./tools/guidelines.js";
import { updateSync } from "./tools/update.js";

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

const transport = new StdioServerTransport();
await mcp.connect(transport);
