# Repository Guidelines

## Project Structure & Module Organization
- src/: TypeScript sources.
  - src/server.ts: MCP entry point (stdio).
  - src/tools/: Tool handlers (docs, evolution, lint, format, guidelines, update).
  - src/utils/: Shared helpers (exec, cache).
- dist/: Build output from TypeScript.
- .cache/: Local mirror for swift-book, swift-evolution, and guidelines HTML.
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
