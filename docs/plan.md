# Swift MCP Server – Roadmap & Phases

This document outlines incremental improvements to the MCP toolset, content, and developer experience. Each phase is scoped to be independently useful and testable.

## Phase 1 — Cache config + Index observability (This phase)

Goals:
- Allow teams to share or relocate caches via an environment variable.
- Provide a quick status view of cached indexes for Apple/HIG/Patterns/Hybrid.

Deliverables:
- `SWIFT_MCP_CACHE_DIR` env var: overrides default `.cache` location.
- New MCP tool `index_status`: reports which indexes exist, their sizes, timestamps, and document counts.

Acceptance criteria:
- Changing `SWIFT_MCP_CACHE_DIR` moves all reads/writes accordingly.
- `index_status` returns JSON with entries for `apple`, `hig`, `patterns`, `hybrid`, including:
  - `path`, `exists`, `sizeBytes`, `mtime`, `documentCount` (when parsable)
  - global `cacheDir` for clarity

## Phase 2 — Docset ingestion

Goals:
- Make it easy to add Apple DocC/Dash content without manual file ops.

Deliverables:
- New tool `apple_docsets_import`:
  - Inputs: `sourcePathOrUrl`, optional `framework`.
  - Behavior: extract/copy into `.cache/apple-docs/<Framework>/…`, reindex Apple + Hybrid.
  - Output: counts per framework and index summary.

Acceptance criteria:
- Importing a docset updates `apple-docs.json` and `hybrid.json` with new symbols.

## Phase 3 — Recipes and scaffolding

Goals:
- Provide actionable domain “recipes” and a quick scaffold for common modules.

Deliverables:
- New tool `swift_recipe_lookup`: lookup YAML-backed recipes (e.g., video overlay export with CoreAnimationTool, AVSynchronizedLayer overlays).
- New tool `swift_scaffold_module`: generate a Swift Package target skeleton with options:
  - `platform: 'macOS'|'iOS'`
  - `moduleName`
  - `overlayStyle: 'swiftui'|'calayer'|'caanimation-export'`

Acceptance criteria:
- Scaffolds compile on target platforms and include a short README.

## Phase 4 — HIG & heuristics enrichment

Goals:
- Better HIG coverage and smarter guideline heuristics for overlays/input.

Deliverables:
- Extend HIG fetch list to a small curated set of stable endpoints (inputs, motion, media, macOS).
- Enhance `swift_guidelines_check` with overlay-specific checks (hit-testing, zIndex, contentShape) and AVFoundation patterns.

Acceptance criteria:
- Hybrid search returns richer HIG coverage; new checks appear on common overlay pitfalls.

## Phase 5 — Documentation improvements

Goals:
- Make onboarding faster and usage clearer.

Deliverables:
- Quickstart playbook: new machine → dev → sync → `index_status`.
- Recipes docs: video overlay (AppKit+SwiftUI), export overlays.
- Cache sharing: document `SWIFT_MCP_CACHE_DIR` and Docker volume setup.

Acceptance criteria:
- New contributors can follow the docs to ingest docsets, verify indexes, and scaffold a module.

