# Recipe: Video Overlay Module (macOS)

This recipe outlines a practical flow to build a video overlay module using AVFoundation with a SwiftUI overlay, plus export.

## MCP Tools Used
- `swift_recipe_lookup` — Confirm the steps and code snippets.
- `cocoa_patterns_search` — Overlay hit-testing, responder chain, child windows.
- `apple_docs_search` / `swift_symbol_lookup` — API details.
- `hig_search` — Inputs/windows guidance.
- `swift_guidelines_check` / `swift_format_apply` / `swift_lint_run` — Quality checks.

## Steps
1. Player surface
   - Wrap `AVPlayerLayer` via `NSViewRepresentable`.
2. UI Overlay
   - Use `ZStack` and `.zIndex` for controls above the video.
   - Use `.allowsHitTesting(false)` for decorative overlays.
3. Timeline sync (optional)
   - Add `AVSynchronizedLayer(playerItem:)` and sublayers for captions/markers.
4. Export (optional)
   - Use `AVMutableVideoComposition` + `AVVideoCompositionCoreAnimationTool` to bake overlays.
5. Validate
   - Run guideline checks, format, lint.

## Commands
```bash
# Recipes
node -e "import('./dist/tools/recipes.js').then(m=>m.swiftRecipeLookup({queryOrId:'video overlay'})).then(r=>console.log(JSON.stringify(r,null,2)))"

# Patterns
node -e "import('./dist/tools/patterns.js').then(m=>m.cocoaPatternsSearch({queryOrTag:'overlay',limit:5})).then(r=>console.log(JSON.stringify(r,null,2)))"

# Apple Docs
node -e "import('./dist/tools/apple_docs.js').then(m=>m.swiftSymbolLookup('AVSynchronizedLayer')).then(r=>console.log(JSON.stringify(r,null,2))).catch(()=>console.log('Add AVFoundation DocC via apple_docsets_import'))"

# HIG
node -e "import('./dist/tools/hig.js').then(m=>m.higSearch({query:'inputs',limit:3})).then(r=>console.log(JSON.stringify(r,null,2)))"

# Quality
node -e "import('node:fs/promises').then(fs=>fs.readFile('/tmp/overlay.swift','utf8')).then(code=>import('./dist/tools/guidelines.js').then(m=>m.guidelinesCheck({code}))).then(r=>console.log(JSON.stringify(r,null,2)))"
```

