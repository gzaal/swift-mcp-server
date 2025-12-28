Swift MCP Server (Swift docs + evolution + lint/format)

[![CI](https://github.com/gzaal/swift-mcp-server/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/gzaal/swift-mcp-server/actions/workflows/ci.yml)

Quick start (macOS)

- Install dependencies:
  - Node 18+
  - Optional: `brew install swift-format swiftformat swiftlint`

- In this folder:
  - `npm install`
  - `npm run dev` (runs server over stdio)
  - `npm run inspector` (UI to test tools)

Tools

- `swift_docs_search`: search TSPL (swift-book) and API Design Guidelines.
- `apple_docs_search`: search local Apple DocC/docsets (AppKit/SwiftUI/Foundation...), supports filters: `frameworks`, `kinds`, `topics`.
- `swift_evolution_lookup`: lookup Swift Evolution proposals by ID or keyword.
- `swift_lint_run`: run SwiftLint if installed.
- `swift_format_apply`: format Swift source via swift-format or SwiftFormat.
- `swift_guidelines_check`: heuristic API guideline checks on Swift code.
- `swift_update_sync`: mirror swift-evolution and swift-book into `.cache`.
- `cocoa_patterns_search`: search curated Cocoa patterns (keyboard/focus/window).
- Additional patterns include responder chain basics, child windows, sheets, and menu shortcut conventions.
- `hig_search`: search local HIG snapshots.
- `swift_symbol_lookup`: resolve a symbol/selector to Apple doc hits.
- `search_hybrid`: unified search across Apple DocC, HIG, and patterns.
  - Returns `{ results, facets }` where `facets` contains sorted counts for `sources`, `frameworks`, `kinds`, `topics`, and `tags`.
- `index_status`: report cache directory and index statuses (apple/hig/patterns/hybrid).
  - Example: `node -e "import('./dist/tools/index_status.js').then(m=>m.indexStatus()).then(r=>console.log(JSON.stringify(r,null,2)))"`
- `apple_docsets_import`: import Apple DocC/Dash content from a local path or URL into `.cache/apple-docs/<Framework>/`, then reindex Apple and Hybrid.
  - Input: `sourcePathOrUrl: string`, `framework?: string`, `reindex?: boolean`
  - Example (local folder with framework subdir): `node -e "import('./dist/tools/docsets_import.js').then(m=>m.importDocsets({sourcePathOrUrl:'content/sample-docc'})).then(console.log)"`
  - Example (archive URL): `node -e "import('./dist/tools/docsets_import.js').then(m=>m.importDocsets({sourcePathOrUrl:'https://example.com/AppKit-docs.zip'})).then(console.log)"`
- `swift_recipe_lookup`: lookup YAML-backed development recipes (e.g., video overlays, export).
  - Input: `queryOrId: string`, `limit?: number`
  - Example: `node -e "import('./dist/tools/recipes.js').then(m=>m.swiftRecipeLookup({queryOrId:'overlay',limit:3})).then(r=>console.log(JSON.stringify(r,null,2)))"`

**Tool Usage**

- `swift_update_sync`:
  - Input: none
  - Behavior: mirrors `swift-evolution`, `swift-book`, caches API Design Guidelines + HIG pages, seeds sample DocC, and builds indexes (Apple, HIG, patterns, hybrid).
  - Example: `node dist/tools/update.js`

- `swift_docs_search`:
  - Input: `query: string`, `limit?: number`
  - Sources: TSPL (swift-book) + API Design Guidelines
  - Example: `node -e "import('./dist/tools/docs.js').then(m=>m.docsSearch({query:'Optionals',limit:3})).then(console.log)"`

- `swift_evolution_lookup`:
  - Input: `query: string`, `limit?: number`
  - Example: `node -e "import('./dist/tools/evolution.js').then(m=>m.evolutionLookup({query:'SE-0001',limit:3})).then(console.log)"`

- `swift_lint_run`:
  - Input: `path?: string`, `configPath?: string`, `strict?: boolean`
  - Requires: `swiftlint` in PATH
  - Example: `node -e "import('./dist/tools/lint.js').then(m=>m.lintRun({path:'/tmp/ci.swift'})).then(console.log)"`

- `swift_format_apply`:
  - Input: `code: string`, `swiftVersion?: string`, `assumeFilepath?: string`
  - Requires: `swift-format` or `swiftformat` in PATH (server falls back gracefully)
  - Example: `node -e "import('./dist/tools/format.js').then(m=>m.formatApply({code:'struct A{}'})).then(console.log)"`

- `swift_guidelines_check`:
  - Input: `code: string`
  - Heuristics: naming, acronym casing, AppKit/SwiftUI bridge checks (monitors, first responder, child windows, identifiers)
  - Example: `node -e "import('./dist/tools/guidelines.js').then(m=>m.guidelinesCheck({code:'class v{}'})).then(console.log)"`

- `apple_docs_search`:
  - Input: `query: string`, `frameworks?: string[]`, `kinds?: string[]`, `topics?: string[]`, `limit?: number`
  - Uses MiniSearch index if present; falls back to file scan under `.cache/apple-docs`
  - Example: `node -e "import('./dist/tools/apple_docs.js').then(m=>m.appleDocsSearch({query:'NSWindow',frameworks:['AppKit'],limit:5})).then(console.log)"`

- `swift_symbol_lookup`:
  - Input: `symbolOrSelector: string`
  - Resolves aliases from `content/symbols/aliases.yaml`, then queries Apple docs
  - Example: `node -e "import('./dist/tools/apple_docs.js').then(m=>m.swiftSymbolLookup('performKeyEquivalent:')).then(console.log)"`

- `cocoa_patterns_search`:
  - Input: `queryOrTag: string`, `limit?: number`
  - Searches curated YAML patterns in repo `content/patterns/` and `.cache/content/patterns/`
  - Example: `node -e "import('./dist/tools/patterns.js').then(m=>m.cocoaPatternsSearch({queryOrTag:'keyboard',limit:5})).then(console.log)"`

- `hig_search`:
  - Input: `query: string`, `limit?: number`
  - Searches `.cache/hig` snapshots; prefers HTML `<title>` and canonical links
  - Example: `node -e "import('./dist/tools/hig.js').then(m=>m.higSearch({query:'keyboard',limit:5})).then(console.log)"`

- `search_hybrid`:
  - Input: `query: string`, `sources?: ('apple'|'hig'|'pattern')[]`, `frameworks?: string[]`, `kinds?: string[]`, `topics?: string[]`, `tags?: string[]`, `limit?: number`
  - Returns: `{ results, facets }` with facet counts
  - Example (class): `node -e "import('./dist/tools/hybrid.js').then(m=>m.hybridSearch({query:'NSWindow',sources:['apple'],frameworks:['AppKit'],limit:5})).then(r=>console.log(JSON.stringify(r,null,2)))"`
  - Example (method): `node -e "import('./dist/tools/hybrid.js').then(m=>m.hybridSearch({query:'performKeyEquivalent',sources:['apple'],frameworks:['AppKit'],kinds:['method'],limit:5})).then(r=>console.log(JSON.stringify(r,null,2)))"`

- `index_status`:
  - Input: none
  - Reports cache directory and index statuses (apple/hig/patterns/hybrid)
  - Example: `node -e "import('./dist/tools/index_status.js').then(m=>m.indexStatus()).then(r=>console.log(JSON.stringify(r,null,2)))"`

- `apple_docsets_import`:
  - Input: `sourcePathOrUrl: string`, `framework?: string`, `reindex?: boolean`
  - Imports Apple DocC/Dash content into `.cache/apple-docs/<Framework>/` and reindexes
  - Example: `node -e "import('./dist/tools/docsets_import.js').then(m=>m.importDocsets({sourcePathOrUrl:'content/sample-docc'})).then(console.log)"`

- `swift_recipe_lookup`:
  - Input: `queryOrId: string`, `limit?: number`
  - Looks up YAML-backed development recipes stored in `content/recipes/`
  - Example: `node -e "import('./dist/tools/recipes.js').then(m=>m.swiftRecipeLookup({queryOrId:'video overlay'})).then(r=>console.log(JSON.stringify(r,null,2)))"`

Docker

- Build: `docker build -t swift-mcp-server .`
- Run: `docker run --rm -it swift-mcp-server`
- Note: This base image does not include Swift formatters/linters. The server
  degrades gracefully if binaries are missing. Extend the image if you need them.

Full Docker image (with tools)

- Build: `npm run docker:build:full` (uses Dockerfile.full)
- Run: `npm run docker:run:full`
  - Mounts `.cache` so `swift_update_sync` persists across runs
- Includes: `swift-format`, `swiftformat`, `swiftlint` built for Linux
- Base: `swift:6.0-jammy` with Node 20 installed

Notes:
- Building Swift tools from source can take several minutes on first build.
- The runtime image includes the Swift runtime by using the `swift:6.0-jammy` base.

MCP wiring

- Most MCP clients accept a stdio command. Example:
  - `node /ABSOLUTE/PATH/swift-mcp-server/dist/server.js`

Cache & Offline

- Run `swift_update_sync` first to populate `.cache` with `swift-evolution` and
  `swift-book`. `swift_docs_search` and `swift_evolution_lookup` use this cache.
- For Apple/HIG:
  - Place DocC/Dash docsets under `.cache/apple-docs/<Framework>/...` or run `swift_update_sync` to fetch a small HIG snapshot into `.cache/hig`.
  - Alternatively use `apple_docsets_import` to ingest content and reindex automatically.
  - Curated patterns live in `content/patterns/*.yaml` and symbol aliases in `content/symbols/aliases.yaml`.
  - A scheduled workflow refreshes HIG weekly; use `workflow_dispatch` to run it on-demand.
  - The first successful `swift_update_sync` will build a MiniSearch index for Apple docs into `.cache/index/apple-docs.json`.
  - The sync also builds HIG (`.cache/index/hig.json`) and patterns (`.cache/index/patterns.json`) indexes for the hybrid search tool.
  - A small sample DocC page is bundled under `content/sample-docc/` and is copied into `.cache/apple-docs/` by `swift_update_sync` to enable CI smoke tests and local try-outs.

**Contributing Content**

- Patterns (`content/patterns/*.yaml`):
  - Fields: `id: string` (unique), `title: string`, `tags?: string[]`, `summary?: string`, `snippet?: string (multiline with |)`, `takeaways?: string[]`.
  - Keep IDs stable; use kebab-case (e.g., `appkit-child-window-attach`).
  - After adding, run `npm run build && node dist/tools/update.js` to reindex.

- Symbol Aliases (`content/symbols/aliases.yaml`):
  - Map canonical symbol -> list of aliases/selectors (e.g., `NSWindow.makeFirstResponder:` -> `-[NSWindow makeFirstResponder:]`).
  - Used by `swift_symbol_lookup` and improves Apple docs resolution.

- Apple DocC / Dash Docsets (`.cache/apple-docs/<Framework>/...`):
  - Place DocC JSON or Dash-extracted content under framework subfolders (AppKit/SwiftUI/Foundation/etc.).
  - Run `swift_update_sync` to index. Bundled samples provide minimal Apple coverage for CI/local dev.

**Known Limitations**

- **HIG content requires JavaScript**: The Apple HIG pages are JavaScript-rendered SPAs. The cached HTML contains "This page requires JavaScript" placeholders instead of actual content. A headless browser scraper would be needed for full HIG support.

- **Patterns and Recipes are user-defined**: The `cocoa_patterns_search` and `swift_recipe_lookup` tools return empty results by default. These are designed for user-contributed content:
  - Add patterns to `content/patterns/*.yaml`
  - Add recipes to `content/recipes/*.yaml`
  - Run `swift_update_sync` to reindex after adding content.

- **Apple docs require population**: The Apple docs index starts empty. Populate it by:
  - Running `apple_docs_populate` tool with specific frameworks
  - Using `apple_docsets_import` to import DocC/Dash content
  - Placing DocC JSON files under `.cache/apple-docs/<Framework>/`

**Troubleshooting**

- Empty Apple results:
  - Ensure `.cache/apple-docs/` contains DocC JSON (run `swift_update_sync` to seed samples).
  - Check `.cache/index/apple-docs.json` exists; if not, re-run `swift_update_sync`.
  - If ingesting docsets, try `apple_docsets_import` and then `index_status`.

- Empty hybrid results:
  - Ensure indexes exist in `.cache/index/` (apple-docs, hig, patterns, hybrid). Re-run `swift_update_sync`.
  - Verify filters aren’t too narrow (try without `kinds`/`topics`/`tags`).

- HIG fetch failures:
  - Non-fatal. The sync is best-effort; you can manually place HTML/MD into `.cache/hig/` and re-run the sync to index.

- Swift tools missing:
  - Install via Homebrew (`brew install swift-format swiftformat swiftlint`) or use the full Docker image.

**CI / Release Quick Reference**

- CI (`.github/workflows/ci.yml`):
  - macOS runner; caches npm and Homebrew; runs `npm ci`, build, smoke tests (docs/evolution/format/lint), `swift_update_sync`, and hybrid smoke tests (class + method).

- Weekly Refresh (`.github/workflows/refresh-cache.yml`):
  - Scheduled Mondays 06:00 UTC (and manual) to run `swift_update_sync` and keep caches/indexes fresh.

- Release (`.github/workflows/release.yml`):
  - Trigger: tag push `v*.*.*`.
  - Builds `dist/` and attaches `dist.tar.gz` to a GitHub Release.
  - Builds and pushes the full Docker image to GHCR as `ghcr.io/<owner>/swift-mcp-server:{tag},latest`.
  - Permissions: `contents: write`, `packages: write` (uses `GITHUB_TOKEN`).

Examples

- Hybrid Apple class search (with facets):
  - `node -e "import('./dist/tools/hybrid.js').then(m=>m.hybridSearch({query:'NSWindow', sources:['apple'], frameworks:['AppKit'], limit:5})).then(r=>console.log(JSON.stringify(r,null,2)))"`
- Hybrid Apple method search with kind filter:
  - `node -e "import('./dist/tools/hybrid.js').then(m=>m.hybridSearch({query:'performKeyEquivalent', sources:['apple'], frameworks:['AppKit'], kinds:['method'], limit:5})).then(r=>console.log(JSON.stringify(r,null,2)))"`
 
See `docs/quickstart.md` for a quick setup, and `docs/recipes/video_overlay.md` for an end-to-end overlay module walkthrough.
See CONTRIBUTING.md for guidelines on adding content and tools.
