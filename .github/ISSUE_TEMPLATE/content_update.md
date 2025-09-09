---
name: "Content: Pattern/Alias/Doc update"
about: Add or update Cocoa patterns, symbol aliases, or cached docs
title: "content: <short summary>"
labels: ["enhancement", "content"]
assignees: []
---

Summary

- What content are you adding or updating? Why does it help?

Content Type

- [ ] Pattern (content/patterns/*.yaml)
- [ ] Symbol Aliases (content/symbols/aliases.yaml)
- [ ] Apple DocC/Dash (placed under .cache/apple-docs)
- [ ] HIG snapshot (placed under .cache/hig)

Proposed Content

```yaml
# If pattern, include a minimal YAML example
```

Acceptance Checklist

- [ ] IDs are unique and stable (kebab-case)
- [ ] Tags are relevant and concise
- [ ] Snippets compile conceptually (syntax-correct)
- [ ] Ran: `npm run build && node dist/tools/update.js`
- [ ] Updated README/CONTRIBUTING if user-facing behavior changed

