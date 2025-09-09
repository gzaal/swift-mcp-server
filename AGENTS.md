# Repository Guidelines

## Project Structure & Module Organization
- src/: TypeScript sources.
  - src/server.ts: MCP entry point (stdio).
  - src/tools/: Tool handlers (docs, evolution, lint, format, guidelines, update).
  - src/utils/: Shared helpers (exec, cache).
- dist/: Build output from TypeScript.
- .cache/: Local mirror for swift-book, swift-evolution, and guidelines HTML.
  - .cache/apple-docs: Apple DocC/Dash content used by Apple docs tools
  - .cache/hig: HIG HTML/MD snapshots
  - .cache/index: MiniSearch indexes (apple-docs.json, hig.json, patterns.json, hybrid.json)
- Dockerfile, Dockerfile.full: Base and “tools-included” images.

## Build, Run, and Development Commands
- npm install: Install Node 18+ dependencies.
- npm run dev: Run server in watch mode via tsx.
- npm run build: Compile TypeScript to dist/.
- npm start: Run compiled server (node dist/server.js).
- npm run inspector: Launch MCP Inspector against dist/server.js.
- npm run inspector:no-auth: Inspector without auth (local use only).
- npm run docker:build:full / docker:run:full: Build/run full image with Swift tools.

Example (fresh dev): npm install && npm run dev

## Coding Style & Naming Conventions
- Language: TypeScript (strict, ES2022 modules, bundler resolution).
- Indentation: 2 spaces; keep lines focused and readable.
- Exports: Prefer named exports; avoid side effects at import time.
- Filenames: lowercase, concise (e.g., tools/format.ts, utils/cache.ts).
- Schemas: Validate tool inputs with zod; keep schemas close to handlers.

## Testing Guidelines
- No unit test harness yet. When adding tests:
  - Place beside source as server.test.ts or under src/**/__tests__.
  - Cover utils (exec, cache) and tool behaviors with realistic inputs.
  - Include a minimal test plan in PR description (commands run, expected output).
- Manual verification: npm run inspector and exercise each tool.

## Commit & Pull Request Guidelines
- Commit style: Conventional Commits (e.g., feat:, fix:, ci:), imperative mood.
- PRs: Small, focused; include what/why, test plan, related issues, and any README updates.
- Include screenshots or JSON snippets from Inspector when helpful.

## Security & Configuration Tips
- .cache is writable and safe to remove; repopulate via swift_update_sync.
- Optional binaries: swift-format, swiftformat, swiftlint. Server degrades gracefully if missing.
- Use inspector:no-auth only locally. For MCP clients, run node dist/server.js over stdio.

## Architecture Overview

- Sources
  - Swift Book + API Design Guidelines (mirrored): used by swift_docs_search
  - Swift Evolution (mirrored): used by swift_evolution_lookup
  - Apple DocC/Dash (user-provided or bundled samples): used by apple_docs_search, swift_symbol_lookup, search_hybrid
  - HIG snapshots (best-effort fetched): used by hig_search and hybrid
  - Curated patterns (YAML): used by cocoa_patterns_search and hybrid

- Indexes (MiniSearch)
  - Apple: symbol/title, summary, snippet, framework, kind, topics → .cache/index/apple-docs.json
  - HIG: title, summary → .cache/index/hig.json
  - Patterns: title, tags, summary, snippet → .cache/index/patterns.json
  - Hybrid: unified index across Apple/HIG/Patterns with consistent fields → .cache/index/hybrid.json

- Tools
  - apple_docs_search: parses DocC JSON deeply (title, abstract, snippet, canonical URL, kind, topics) with ranking/dedupe
  - swift_symbol_lookup: resolves aliases then reuses apple_docs_search
  - cocoa_patterns_search: YAML-backed curated notes
  - hig_search: HTML/MD snapshots with canonical link extraction
  - search_hybrid: unified search across sources; returns results and facet counts
  - Existing: swift_docs_search, swift_evolution_lookup, swift_lint_run, swift_format_apply, swift_guidelines_check, swift_update_sync

- Sync Pipeline (swift_update_sync)
  - Mirrors swift-book and swift-evolution; caches API Guidelines; seeds sample DocC
  - Builds/saves indexes for Apple, HIG, patterns, and hybrid in one run

### Architecture Diagram (ASCII)

```
            +--------------------+        +------------------+
            |  Swift Book (TSPL) |        | Swift Evolution  |
            +--------------------+        +------------------+
                      |                            |
                      v                            v
                 (mirror into)                (mirror into)
                    .cache                        .cache
                        \                             /
                         v                           v
  +----------------+   +------------------------+   +----------------+
  | API Guidelines |   | Apple DocC / Dashsets |   | HIG Snapshots  |
  +----------------+   +------------------------+   +----------------+
           |                      |                          |
           v                      v                          v
      (cached HTML)     .cache/apple-docs/<Framework>    .cache/hig
                                 |                          |
                                 v                          v
                      +-------------------+       +-------------------+
                      |  Index Builders   |       |  Index Builders   |
                      |  (MiniSearch)     |       |  (MiniSearch)     |
                      +-------------------+       +-------------------+
                             |   |   |                    |
                             |   |   |                    |
                             v   v   v                    v
                   .cache/index/apple-docs.json   .cache/index/hig.json
                   .cache/index/patterns.json     .cache/index/hybrid.json

                               +-------------------------------+
                               |           MCP Server          |
                               |  src/server.ts registers:     |
                               |  - docs/evolution tools       |
                               |  - lint/format/guidelines     |
                               |  - apple_docs/symbol_lookup   |
                               |  - patterns/hig               |
                               |  - search_hybrid (facets)     |
                               +-------------------------------+
```
