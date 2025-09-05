Swift MCP Server (Swift docs + evolution + lint/format)

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
- `swift_evolution_lookup`: lookup Swift Evolution proposals by ID or keyword.
- `swift_lint_run`: run SwiftLint if installed.
- `swift_format_apply`: format Swift source via swift-format or SwiftFormat.
- `swift_guidelines_check`: heuristic API guideline checks on Swift code.
- `swift_update_sync`: mirror swift-evolution and swift-book into `.cache`.

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
