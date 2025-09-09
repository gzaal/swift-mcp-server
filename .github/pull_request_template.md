## What

Describe the change: tools added/updated, content added (patterns/aliases), sync/index changes, docs.

## Why

Motivation and expected impact. Link related issues.

## Changes

- Tools/APIs: names, input schemas, output shapes
- Indexing: which indexes touched (apple/hig/patterns/hybrid)
- Content: new/updated pattern files or aliases
- CI/Docs: workflow changes, README/AGENTS/CONTRIBUTING updates

## Validation / Test Plan

- Commands run and outputs (paste relevant JSON snippets)
- Inspector steps exercised
- `npm run build && node dist/tools/update.js` output summary

## Screenshots / JSON (optional)

Attach Inspector screenshots or JSON payloads if helpful.

## Checklist

- [ ] Conventional commit message (feat/fix/docs/ci/chore/...)
- [ ] Builds locally (`npm run build`)
- [ ] Ran `swift_update_sync` and verified indexes
- [ ] CI green (or identified unrelated flakes)
- [ ] README/AGENTS/CONTRIBUTING updated as needed
- [ ] New tool schemas validated (zod) and documented

