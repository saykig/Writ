# `@writ/data-bundle`

Writ-owned deterministic export of the current canonical repository state. The bundle is a neutral
consumer boundary: it contains catalogued corpora, canonical records, evidence resources, Core
record links, judgments, exact stored record source and genuine compiler output. It contains no
homepage selections, Lab fixtures, search index, presentation ordering or other web decisions.

The exporter reads only the current repository worktree. It performs no network access, model
inference, randomness, wall-clock reads or source mutation. Verification and human acceptance are
upstream processes; exporting does not approve, publish or filter records.

```bash
bun run data:export
bun run data:check
```

The default output is `dist/data/writ-data-bundle.json`.
