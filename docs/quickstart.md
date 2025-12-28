# Quickstart

This guide gets you from zero to a working MCP server with cached indexes.

## Setup
- Prereqs: Node 18+, optional `swift-format`, `swiftformat`, `swiftlint` on PATH.
- Install deps: `npm install`
- Dev server (stdio): `npm run dev`

## Populate caches
- Sync sources and build indexes: `node dist/tools/update.js` or via Inspector tool `swift_update_sync`.
- Verify: `node -e "import('./dist/tools/index_status.js').then(m=>m.indexStatus()).then(r=>console.log(JSON.stringify(r,null,2)))"`
- Optional: Share cache across projects by setting `SWIFT_MCP_CACHE_DIR` to a shared path.

## Import Apple DocC
- Import a folder or archive: `node -e "import('./dist/tools/docsets_import.js').then(m=>m.importDocsets({sourcePathOrUrl:'content/sample-docc'})).then(console.log)"`
- Re-check status: run `index_status` again.

## Explore
- Apple docs: `apple_docs_search { query: 'NSWindow', frameworks: ['AppKit'] }`
- HIG: `hig_search { query: 'inputs' }`
- Patterns: `cocoa_patterns_search { queryOrTag: 'overlay' }`
- Recipes: `swift_recipe_lookup { queryOrId: 'video overlay' }`

## Code Quality
- Guidelines: `swift_guidelines_check { code }`
- Format: `swift_format_apply { code }`
- Lint: `swift_lint_run { path }`

