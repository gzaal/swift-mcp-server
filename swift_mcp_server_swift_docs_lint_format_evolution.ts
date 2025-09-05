// swift-mcp-server — a minimal MCP server that gives your coding agent
// fast access to Swift docs, evolution status, API guidelines checks,
// SwiftLint, and formatters (swift-format / SwiftFormat).
//
// ─────────────────────────────────────────────────────────────────────────────
// Files in this canvas:
//   • package.json
//   • tsconfig.json
//   • src/server.ts
//   • src/tools/docs.ts
//   • src/tools/evolution.ts
//   • src/tools/lint.ts
//   • src/tools/format.ts
//   • src/tools/guidelines.ts
//   • src/tools/update.ts
//   • src/utils/shell.ts
//   • README.md (at bottom)
// ─────────────────────────────────────────────────────────────────────────────

// ───────────────────────────── package.json ─────────────────────────────
{
  "name": "swift-mcp-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "MCP server: Swift docs search, Swift Evolution lookup, SwiftLint, swift-format/SwiftFormat, API guidelines checks.",
  "scripts": {
    "dev": "ts-node --transpile-only src/server.ts",
    "build": "tsc -p .",
    "start": "node dist/server.js",
    "inspector": "npm run build && npx @modelcontextprotocol/inspector node ./dist/server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.17.5",
    "cheerio": "^1.0.0-rc.12",
    "execa": "^8.0.1",
    "simple-git": "^3.22.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.12",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  }
}

// ───────────────────────────── tsconfig.json ────────────────────────────
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}

// ───────────────────────────── src/server.ts ────────────────────────────
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { docsSearch } from "./tools/docs.js";
import { evolutionLookup } from "./tools/evolution.js";
import { runSwiftLint } from "./tools/lint.js";
import { applyFormat } from "./tools/format.js";
import { checkGuidelines } from "./tools/guidelines.js";
import { updateSync } from "./tools/update.js";

const server = new McpServer({ name: "swift-mcp-server", version: "0.1.0" });

// Tool: swift.docs.search
server.registerTool(
  "swift.docs.search",
  {
    title: "Search Swift docs (TSPL / guidelines)",
    description:
      "Searches official Swift docs & guidelines. Returns ranked links and snippets.",
    inputSchema: {
      query: z.string(),
      maxResults: z.number().min(1).max(10).default(5),
      sources: z
        .array(z.enum(["tspl", "guidelines"]))
        .default(["tspl", "guidelines"]) // filter to just TSPL or guidelines
        .optional()
    }
  },
  async ({ query, maxResults, sources }) => {
    const out = await docsSearch(query, maxResults ?? 5, sources ?? ["tspl", "guidelines"]);
    return { content: [{ type: "text", text: out }] };
  }
);

// Tool: swift.evolution.lookup
server.registerTool(
  "swift.evolution.lookup",
  {
    title: "Swift Evolution lookup",
    description:
      "Look up a Swift Evolution proposal by SE-#### or keywords; returns title, status, and links.",
    inputSchema: { idOrKeywords: z.string() }
  },
  async ({ idOrKeywords }) => {
    const out = await evolutionLookup(idOrKeywords);
    return { content: [{ type: "text", text: out }] };
  }
);

// Tool: swift.lint.run
server.registerTool(
  "swift.lint.run",
  {
    title: "Run SwiftLint",
    description:
      "Runs SwiftLint (if installed) and returns violations as JSON. Accepts paths and optional config.",
    inputSchema: {
      paths: z.array(z.string()).min(1),
      configPath: z.string().optional(),
      strict: z.boolean().default(false)
    }
  },
  async ({ paths, configPath, strict }) => {
    const out = await runSwiftLint(paths, configPath, strict ?? false);
    return { content: [{ type: "text", text: out }] };
  }
);

// Tool: swift.format.apply
server.registerTool(
  "swift.format.apply",
  {
    title: "Apply swift-format / SwiftFormat",
    description:
      "Formats Swift code with Apple swift-format (preferred) or SwiftFormat. Modes: check (lint) or write.",
    inputSchema: {
      paths: z.array(z.string()).min(1),
      engine: z.enum(["auto", "swift-format", "swiftformat"]).default("auto"),
      mode: z.enum(["check", "write"]).default("check"),
      configPath: z.string().optional()
    }
  },
  async ({ paths, engine, mode, configPath }) => {
    const out = await applyFormat(paths, engine, mode, configPath);
    return { content: [{ type: "text", text: out }] };
  }
);

// Tool: swift.guidelines.check
server.registerTool(
  "swift.guidelines.check",
  {
    title: "Heuristic API Guidelines check",
    description:
      "Runs lightweight heuristics on a diff or snippet to flag common API Design Guideline issues.",
    inputSchema: {
      diff: z.string().describe("Unified diff or added lines to inspect")
    }
  },
  async ({ diff }) => {
    const out = await checkGuidelines(diff);
    return { content: [{ type: "text", text: out }] };
  }
);

// Tool: swift.update.sync
server.registerTool(
  "swift.update.sync",
  {
    title: "Sync Swift sources (Evolution + TSPL mirror)",
    description:
      "Clones/updates local mirrors for swift-evolution and swift-book to ./.cache for faster lookups.",
    inputSchema: {
      shallow: z.boolean().default(true)
    }
  },
  async ({ shallow }) => {
    const out = await updateSync(shallow ?? true);
    return { content: [{ type: "text", text: out }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("swift-mcp-server running over stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

// ─────────────────────────── src/tools/docs.ts ───────────────────────────
import { load as cheerioLoad } from "cheerio";

const TSPL_SITE = "docs.swift.org";
const GUIDELINES_URL = "https://swift.org/documentation/api-design-guidelines/";

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": "swift-mcp-server/0.1" } });
  return await r.text();
}

async function ddgSearch(query: string, site: string, max: number) {
  const q = encodeURIComponent(`site:${site} ${query}`);
  const url = `https://duckduckgo.com/html/?q=${q}`;
  const html = await fetchText(url);
  const $ = cheerioLoad(html);
  const items: { title: string; url: string; snippet: string }[] = [];
  $(".result__body").each((_, el) => {
    if (items.length >= max) return;
    const a = $(el).find("a.result__a");
    const title = a.text().trim();
    const href = a.attr("href") ?? "";
    const snip = $(el).find(".result__snippet").text().trim();
    if (title && href) items.push({ title, url: href, snippet: snip });
  });
  // fallback selector if DuckDuckGo markup changes
  if (items.length === 0) {
    $("a[href]").each((_, a) => {
      if (items.length >= max) return;
      const href = $(a).attr("href") ?? "";
      const title = $(a).text().trim();
      if (href.includes(site) && title) {
        items.push({ title, url: href, snippet: "" });
      }
    });
  }
  return items;
}

export async function docsSearch(query: string, maxResults: number, sources: ("tspl" | "guidelines")[]) {
  const lines: string[] = [];
  if (sources.includes("tspl")) {
    const results = await ddgSearch(query, TSPL_SITE, maxResults);
    if (results.length) {
      lines.push("# TSPL (docs.swift.org)");
      for (const r of results) {
        lines.push(`• ${r.title}\n  ${r.url}`);
        if (r.snippet) lines.push(`  ${r.snippet}`);
      }
      lines.push("");
    }
  }
  if (sources.includes("guidelines")) {
    // Always include the guidelines top link first
    lines.push(`# API Design Guidelines\n• Swift.org guidelines\n  ${GUIDELINES_URL}`);
    // And try a targeted search for the query within swift.org
    const results = await ddgSearch(query, "swift.org", Math.max(0, maxResults - 1));
    for (const r of results) {
      if (!r.url.includes("swift.org/documentation")) continue; // bias to docs pages
      lines.push(`• ${r.title}\n  ${r.url}`);
      if (r.snippet) lines.push(`  ${r.snippet}`);
    }
  }
  if (lines.length === 0) return `No results found for: ${query}`;
  return lines.join("\n");
}

// ──────────────────────── src/tools/evolution.ts ─────────────────────────
import { load as $load } from "cheerio";

function looksLikeSEId(s: string) {
  return /^SE-?\d{4}$/i.test(s);
}

async function fetchPage(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": "swift-mcp-server/0.1" } });
  return await r.text();
}

async function searchEvolution(term: string) {
  const q = encodeURIComponent(`site:swift.org/swift-evolution ${term}`);
  const url = `https://duckduckgo.com/html/?q=${q}`;
  const html = await fetchPage(url);
  const $ = $load(html);
  const hits: { title: string; url: string }[] = [];
  $(".result__body a.result__a").each((_, a) => {
    const title = $(a).text().trim();
    const href = $(a).attr("href") ?? "";
    if (title && href) hits.push({ title, url: href });
  });
  return hits;
}

function extractStatusFromEvolutionPage(html: string): string | null {
  const $ = $load(html);
  const text = $.text();
  const m = text.match(/Status:\s*([A-Za-z ]+)/);
  return m ? m[1].trim() : null;
}

export async function evolutionLookup(idOrKeywords: string) {
  let lines: string[] = [];
  if (looksLikeSEId(idOrKeywords)) {
    const id = idOrKeywords.toUpperCase().replace("SE", "SE-");
    const hits = await searchEvolution(id);
    if (hits.length) {
      const top = hits[0];
      const html = await fetchPage(top.url);
      const status = extractStatusFromEvolutionPage(html);
      lines.push(`${id}: ${top.title}`);
      if (status) lines.push(`Status: ${status}`);
      lines.push(top.url);
      return lines.join("\n");
    }
  }
  // keyword search
  const hits = await searchEvolution(idOrKeywords);
  if (!hits.length) return `No Swift Evolution results for: ${idOrKeywords}`;
  lines.push(`# Top Swift Evolution results for: ${idOrKeywords}`);
  for (const h of hits.slice(0, 5)) {
    lines.push(`• ${h.title}\n  ${h.url}`);
  }
  return lines.join("\n");
}

// ─────────────────────────── src/tools/lint.ts ───────────────────────────
import { execa } from "execa";
import { which } from "../utils/shell.js";

export async function runSwiftLint(paths: string[], configPath?: string, strict = false) {
  const has = await which("swiftlint");
  if (!has) return `SwiftLint not found on PATH. Install via Homebrew: brew install swiftlint`;

  const args = ["lint", "--reporter", "json"];
  if (configPath) args.push("--config", configPath);

  let output = "";
  for (const p of paths) {
    try {
      const { stdout } = await execa("swiftlint", [...args, "--path", p], { reject: false });
      // stdout is JSON array; accumulate (as text to keep MCP payload small)
      output += `\n# ${p}\n` + stdout + "\n";
    } catch (e: any) {
      output += `\n# ${p}\nError running SwiftLint: ${e.message}\n`;
    }
  }

  if (strict && !/\"severity\":\"error\"/.test(output) && /\"severity\":\"warning\"/.test(output)) {
    output += "\nStrict mode: Treating warnings as errors.";
  }
  return output.trim();
}

// ────────────────────────── src/tools/format.ts ──────────────────────────
import { execa as run } from "execa";
import { which } from "../utils/shell.js";

export async function applyFormat(
  paths: string[],
  engine: "auto" | "swift-format" | "swiftformat",
  mode: "check" | "write",
  configPath?: string
) {
  const preferSwiftFormat = async () => (await which("swift-format")) || (await which("swift"));
  const preferSwiftFormatEngine = await preferSwiftFormat();
  const preferSwiftFormatAvailable = Boolean(preferSwiftFormatEngine);
  const swiftFormatCfgArg = configPath ? ["--configuration", configPath] : [];

  if ((engine === "auto" || engine === "swift-format") && preferSwiftFormatAvailable) {
    try {
      // Try the standalone swift-format first
      if (await which("swift-format")) {
        const args = mode === "check"
          ? ["lint", "-r", ...paths, ...swiftFormatCfgArg]
          : ["format", "-i", "-r", ...paths, ...swiftFormatCfgArg];
        const { stdout } = await run("swift-format", args, { reject: false });
        return stdout || `swift-format ${mode} completed.`;
      }
      // Fallback to integrated `swift format` subcommand
      if (await which("swift")) {
        const args = ["format", "-m", mode, ...paths];
        if (configPath) args.push("--swift-format-configuration", configPath);
        const { stdout } = await run("swift", args, { reject: false });
        return stdout || `swift format -m ${mode} completed.`;
      }
    } catch (e: any) {
      // fall through to SwiftFormat
    }
  }

  if (engine === "swiftformat" || engine === "auto") {
    if (!(await which("swiftformat"))) {
      return "SwiftFormat CLI not found on PATH (try: brew install swiftformat).";
    }
    const args = mode === "check" ? ["--lint", ...paths] : [...paths];
    if (configPath) args.push("--config", configPath);
    const { stdout } = await run("swiftformat", args, { reject: false });
    return stdout || `SwiftFormat ${mode} completed.`;
  }

  return "No formatter available; please install swift-format or SwiftFormat.";
}

// ──────────────────────── src/tools/guidelines.ts ────────────────────────
// Very lightweight heuristics for Swift API Design Guidelines.
// Input: git-style diff; we scan added lines for common pitfalls.

const GUIDELINES = {
  GET: "Use ‘get’ only for methods that return values indirectly (inout/pointer).",
  CLARITY: "Prefer clarity at the point of use; avoid needless words.",
};

export async function checkGuidelines(diff: string) {
  const added = diff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1));

  const findings: string[] = [];

  // 1) Flag funcs starting with getXxx(
  for (const line of added) {
    const m = line.match(/\bfunc\s+(get[A-Z][A-Za-z0-9_]*)\s*\(/);
    if (m) {
      findings.push(`• ${m[1]} — ${GUIDELINES.GET}`);
    }
  }

  // 2) Flag ALL_CAPS or hungarian-ish names in identifiers
  for (const line of added) {
    const ids = line.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
    for (const id of ids) {
      if (/^[A-Z0-9_]{5,}$/.test(id)) {
        findings.push(`• Identifier ‘${id}’ looks like a constant macro; prefer lowerCamelCase names.`);
      }
      if (/^mgr|cfg|svc|util/i.test(id) && id.length <= 6) {
        findings.push(`• Abbreviation in ‘${id}’; expand for clarity (e.g., manager, configuration, service).`);
      }
    }
  }

  if (!findings.length) return "No obvious guideline issues detected in the provided diff.";

  return [
    "# Potential API Guideline issues",
    ...findings,
    "",
    "See: Swift API Design Guidelines (swift.org)"
  ].join("\n");
}

// ────────────────────────── src/tools/update.ts ──────────────────────────
import simpleGit from "simple-git";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CACHE = join(process.cwd(), ".cache");

async function ensureRepo(url: string, dir: string, shallow: boolean) {
  if (!existsSync(CACHE)) mkdirSync(CACHE);
  const git = simpleGit({ baseDir: CACHE });
  const target = join(CACHE, dir);
  if (!existsSync(target)) {
    await git.clone(url, target, shallow ? ["--depth", "1"] : []);
    return `Cloned ${url} → ${target}`;
  } else {
    const g2 = simpleGit({ baseDir: target });
    await g2.fetch(["--all"]);
    await g2.pull(["--ff-only"]);
    return `Updated ${target}`;
  }
}

export async function updateSync(shallow = true) {
  const lines: string[] = [];
  lines.push(await ensureRepo("https://github.com/swiftlang/swift-evolution.git", "swift-evolution", shallow));
  lines.push(await ensureRepo("https://github.com/swiftlang/swift-book.git", "swift-book", shallow));
  return lines.join("\n");
}

// ─────────────────────────── src/utils/shell.ts ──────────────────────────
import { execa } from "execa";

export async function which(cmd: string) {
  try {
    const { stdout } = await execa(process.platform === "win32" ? "where" : "which", [cmd]);
    return Boolean(stdout?.trim());
  } catch {
    return false;
  }
}

// ───────────────────────────────── README.md ─────────────────────────────
/*
# swift-mcp-server

A small **Model Context Protocol (MCP)** server that gives your coding agent access to:

- **Swift docs search** (TSPL + API Design Guidelines)
- **Swift Evolution lookup** by `SE-####` or keywords
- **SwiftLint** (violations as JSON)
- **Formatters**: Apple `swift-format` (preferred) and Nick Lockwood’s `SwiftFormat`
- **Heuristic API Guidelines checks** on a diff
- **Local mirrors** of `swift-evolution` and `swift-book` for faster lookups

## Prereqs
- Node.js 18+ (Node 20+ recommended)
- Optional: `swiftlint`, `swift-format` and/or `swiftformat` on PATH
  - macOS (Homebrew):
    - `brew install swiftlint`
    - `brew install swift-format`  # (or use `swift format` bundled with Swift 6)
    - `brew install swiftformat`

## Install & Run
```bash
npm install
npm run dev           # stdio transport (recommended for IDE/agents)
# or build
npm run build && npm start
```

## Test with MCP Inspector (great for first run)
```bash
npm run inspector
```
This opens a local UI to try the tools and see the JSON payloads.

## Tools overview
- `swift.docs.search({ query, maxResults?, sources? })`
- `swift.evolution.lookup({ idOrKeywords })`
- `swift.lint.run({ paths, configPath?, strict? })`
- `swift.format.apply({ paths, engine?, mode?, configPath? })`
- `swift.guidelines.check({ diff })`
- `swift.update.sync({ shallow? })`

## Wiring into your agent
Most MCP-aware clients let you register a server with a **command** + **args** launched over **stdio**.
For example:
```jsonc
{
  "mcpServers": {
    "swift": {
      "command": "node",
      "args": ["/absolute/path/to/swift-mcp-server/dist/server.js"]
    }
  }
}
```
If your client supports **Streamable HTTP** instead, adapt `src/server.ts` to create an HTTP transport; stdio is the simplest.

## Notes
- `swift.docs.search` uses a small site-restricted web search for `docs.swift.org` and `swift.org/documentation` and returns links + snippets.
- `swift.evolution.lookup` prioritizes `swift.org/swift-evolution` pages and attempts to extract a **Status** line if present.
- `swift.format.apply` prefers **Apple’s swift-format** when available, and falls back to **SwiftFormat**.
- `swift.lint.run` uses `swiftlint lint --reporter json --path <path>` per target path.

## Roadmap ideas
- Index the local mirrors (.cache) to provide fully offline `docs.search` and `evolution.lookup`.
- Add a `swift.symbols.diff` tool based on symbol graphs to flag potential source breaks.
- Offer richer guideline checks (Bool-return naming, argument label clarity, acronym casing).
*/
