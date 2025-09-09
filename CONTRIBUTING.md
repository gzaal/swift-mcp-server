Contributing Guide

Thank you for your interest in improving the Swift MCP Server! This document explains how to contribute content and code, and how to validate changes locally and in CI.

Content Contributions

- Patterns (content/patterns/*.yaml)
  - Fields: id (unique, kebab-case), title, tags[], summary, snippet (use YAML multiline |), takeaways[].
  - Keep IDs stable; prefer concise titles and actionable takeaways.
  - After editing, rebuild and reindex: npm run build && node dist/tools/update.js

- Symbol Aliases (content/symbols/aliases.yaml)
  - Map canonical symbol names to aliases/selectors, e.g. NSWindow.makeFirstResponder: -> -[NSWindow makeFirstResponder:]
  - Improves swift_symbol_lookup and Apple docs resolution.

- Apple DocC / Dash Docsets (.cache/apple-docs/<Framework>/...)
  - Place DocC JSON under the appropriate Framework folder (AppKit/SwiftUI/Foundation/etc.).
  - For local smoke/CI, sample pages live under content/sample-docc/ and are seeded by swift_update_sync.

Code Contributions

- Tools and Schemas
  - Add new tools under src/tools/, validate inputs with zod and keep schemas near handlers.
  - Return concise, structured JSON payloads. Avoid side effects except when clearly documented.

- Indexing
  - MiniSearch-based indexes live in src/utils/*_index.ts and output under .cache/index/.
  - Update src/tools/update.ts to build/refresh indexes as part of swift_update_sync.

Style and Commit Messages

- TypeScript strict mode (ES2022 modules, bundler resolution). Two-space indent.
- Use Conventional Commits: feat:, fix:, docs:, ci:, chore:, refactor:, perf:.
- Keep PRs focused; include what/why, test plan, and README/CONTRIBUTING updates when relevant.

Local Validation

- Build: npm run build
- Update caches/indexes: node dist/tools/update.js
- Run Inspector: npm run inspector (or npm run inspector:no-auth locally)
- Quick tool tests: use node -e examples in README Tool Usage.

CI & Release

- CI runs hybrid smoke tests using bundled sample DocC and validates key tools.
- Weekly refresh updates caches/indexes.
- Release workflow builds dist.tar.gz and publishes a full Docker image to GHCR on tag push.

Security & Licensing

- Do not commit proprietary or licensed Apple documentation. Use sample pages or instruct users to place their docsets under .cache/apple-docs.
- Avoid adding external network calls outside swift_update_sync; keep fetchers opt-in and cache results to .cache/.

