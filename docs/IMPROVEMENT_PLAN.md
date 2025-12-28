# Swift MCP Server Improvement Plan

## Executive Summary

Investigation revealed all tools are **functional but content-starved**. The server has only 3 Apple doc symbols, 8 HIG pages, and 8 patterns indexed. This plan transforms the server from a static documentation cache into a **self-populating, project-aware documentation engine**.

## Current State Analysis

### Content Inventory
| Source | Documents | Status |
|--------|-----------|--------|
| Apple Docs | 3 | Only sample AppKit symbols |
| HIG | 8 | Basic cached pages |
| Patterns | 8 | Complete (all YAML files) |
| Recipes | 4 | Complete |
| TSPL | 0 indexed | Content exists, not in hybrid index |
| **Total** | **23** | Severely limited |

### MetaScope Framework Usage (Test Project)
```
191 Foundation    170 SwiftUI      99 AppKit
 42 Photos        29 UTType       22 CoreLocation
 21 Combine       13 AVFoundation 12 os/signpost
 11 CoreGraphics  10 ImageIO       8 MapKit
  8 StoreKit       6 Metal         5 CoreImage
```

## Strategic Vision

Transform from **static cache** → **intelligent documentation engine** that:
1. **Auto-discovers** which frameworks your project uses
2. **Fetches on-demand** from Apple's JSON API
3. **Prioritizes** documentation based on actual usage
4. **Learns** from query patterns to improve coverage

## Implementation Phases

### Phase 1: Foundation (Priority: Critical)
**Goal**: Fix core indexing gaps

#### 1.1 Add TSPL to Hybrid Index
- Parse `.cache/swift-book/TSPL.docc/**/*.md` files
- Extract sections, code examples, and headers
- Add to unified MiniSearch index
- **Impact**: Language reference becomes searchable in hybrid

#### 1.2 Fix Dead Path Checks
```typescript
// Before (patterns.ts, recipes.ts)
const cacheDir = join(CACHE_DIR, "content", "patterns"); // Never exists

// After
const repoDir = resolve(process.cwd(), "content", "patterns"); // Primary
```

#### 1.3 Add Content Health to index_status
```json
{
  "health": {
    "apple": { "count": 3, "status": "limited", "recommendation": "Run auto-populate" },
    "tspl": { "count": 45, "status": "indexed" },
    "hig": { "count": 8, "status": "limited" }
  }
}
```

### Phase 2: Apple Docs Auto-Population (Priority: High)
**Goal**: Automatic framework documentation fetching

#### 2.1 Framework Discovery Tool
New tool: `swift_project_scan`
```typescript
// Scans a Swift project for imports
const imports = await scanProjectImports("/path/to/MetaScope");
// Returns: ["SwiftUI", "AppKit", "Photos", "AVFoundation", ...]
```

#### 2.2 Apple Docs Fetcher
Leverage Apple's public JSON API:
```
https://developer.apple.com/tutorials/data/documentation/{framework}.json
```

Response structure:
```json
{
  "identifier": { "url": "doc://com.apple.SwiftUI/documentation/SwiftUI" },
  "topicSections": [
    { "title": "Views", "identifiers": ["doc://...Text", "doc://...Image"] }
  ]
}
```

#### 2.3 Hierarchical Crawling Strategy
```
Depth 0: Framework overview (SwiftUI.json)
Depth 1: Topic sections (Views, Modifiers, State)
Depth 2: Individual symbols (Text, Image, Button)
Depth 3: Methods/Properties (optional, for key symbols)
```

Configuration:
```yaml
populate:
  frameworks: [SwiftUI, AppKit, Foundation]
  depth: 2
  priority_symbols: [View, NavigationSplitView, NSWindow]
  max_symbols_per_framework: 100
```

#### 2.4 New Tool: `apple_docs_populate`
```typescript
interface PopulateInput {
  frameworks?: string[];      // Specific frameworks, or auto-detect
  projectPath?: string;       // Scan this project for imports
  depth?: number;             // 1-3, default 2
  maxPerFramework?: number;   // Limit symbols, default 50
}
```

### Phase 3: Smart Caching (Priority: Medium)
**Goal**: Efficient, fresh documentation

#### 3.1 TTL-Based Cache
```typescript
interface CacheEntry {
  content: any;
  fetchedAt: Date;
  ttl: number;        // Default 7 days
  accessCount: number;
  lastAccessed: Date;
}
```

#### 3.2 Query Analytics
Track failed queries to identify gaps:
```json
{
  "failedQueries": [
    { "query": "NavigationStack", "count": 5, "framework": "SwiftUI" },
    { "query": "PhotosPicker", "count": 3, "framework": "PhotosUI" }
  ]
}
```

#### 3.3 Auto-Refresh Daemon
```typescript
// Refresh most-accessed symbols weekly
// Refresh failed-query symbols immediately
// Prune unused entries after 30 days
```

### Phase 4: Project Integration (Priority: Future)
**Goal**: Context-aware documentation

#### 4.1 Project Binding
```typescript
// In Claude Code settings or MCP config
{
  "swift-mcp": {
    "boundProject": "/Users/dev/MetaScope",
    "autoPopulate": true
  }
}
```

#### 4.2 Contextual Suggestions
When editing a SwiftUI file, prioritize SwiftUI docs.
When working on AVFoundation code, suggest video-related patterns.

## Implementation Order

```
Week 1: Phase 1 (Foundation)
├── 1.1 TSPL indexing [4 hours]
├── 1.2 Path fixes [1 hour]
└── 1.3 Health status [2 hours]

Week 2: Phase 2 (Auto-Population)
├── 2.1 Project scanner [3 hours]
├── 2.2 Apple docs fetcher [4 hours]
├── 2.3 Crawl strategy [3 hours]
└── 2.4 Populate tool [2 hours]

Week 3: Testing & Refinement
├── MetaScope integration test
├── Performance optimization
└── Documentation
```

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Apple doc symbols | 3 | 500+ |
| TSPL chapters indexed | 0 | 45+ |
| Query success rate | ~20% | 90%+ |
| Cold start time | 0s | <5s (with cache) |

## Risk Mitigation

1. **Rate Limiting**: Apple may rate-limit. Solution: Respect headers, add delays, cache aggressively.
2. **API Changes**: JSON structure may change. Solution: Robust parsing, fallback to scraping.
3. **Storage Growth**: Many symbols = large cache. Solution: LRU eviction, compression.

## Files to Modify/Create

### New Files
- `src/tools/project_scan.ts` - Scan Swift projects for imports
- `src/tools/docs_populate.ts` - Auto-populate from Apple
- `src/utils/docs_fetcher.ts` - HTTP client for Apple docs
- `src/utils/tspl_index.ts` - TSPL markdown indexer

### Modified Files
- `src/utils/hybrid_index.ts` - Add TSPL source
- `src/tools/patterns.ts` - Fix path checks
- `src/tools/recipes.ts` - Fix path checks
- `src/tools/index_status.ts` - Add health metrics
- `src/server.ts` - Register new tools

## Testing Strategy

### Unit Tests
- TSPL markdown parsing
- Apple docs JSON parsing
- Import statement extraction

### Integration Tests
- Full populate workflow with MetaScope
- Query success rate before/after
- Cache persistence

### Manual Validation
- Search for MetaScope's actual imports
- Verify snippet quality
- Check URL generation

---

*Created: 2024-12-28*
*Author: Claude Code + MetaScope feedback loop*
