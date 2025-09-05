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

- `swift.docs.search`: search TSPL (swift-book) and API Design Guidelines.
- `swift.evolution.lookup`: lookup Swift Evolution proposals by ID or keyword.
- `swift.lint.run`: run SwiftLint if installed.
- `swift.format.apply`: format Swift source via swift-format or SwiftFormat.
- `swift.guidelines.check`: heuristic API guideline checks on Swift code.
- `swift.update.sync`: mirror swift-evolution and swift-book into `.cache`.

Docker

- Build: `docker build -t swift-mcp-server .`
- Run: `docker run --rm -it swift-mcp-server`
- Note: This base image does not include Swift formatters/linters. The server
  degrades gracefully if binaries are missing. Extend the image if you need them.

Full Docker image (with tools)

- Build: `npm run docker:build:full` (uses Dockerfile.full)
- Run: `npm run docker:run:full`
  - Mounts `.cache` so `swift.update.sync` persists across runs
- Includes: `swift-format`, `swiftformat`, `swiftlint` built for Linux
- Base: `swift:6.0-jammy` with Node 20 installed

Notes:
- Building Swift tools from source can take several minutes on first build.
- The runtime image includes the Swift runtime by using the `swift:6.0-jammy` base.

MCP wiring

- Most MCP clients accept a stdio command. Example:
  - `node /ABSOLUTE/PATH/swift-mcp-server/dist/server.js`

Cache & Offline

- Run `swift.update.sync` first to populate `.cache` with `swift-evolution` and
  `swift-book`. `swift.docs.search` and `swift.evolution.lookup` use this cache.
