# `@writ/data-bundle`

Writ-owned deterministic export of a deliberately chosen canonical repository state. The bundle is
an immutable, read-only projection snapshot identified by the exact Writ commit and its bundle
hash. It is not a synchronization mechanism. An operator exports it after verification and human
review, then may deliberately replace a pinned snapshot in an external consumer such as Writ-Web.
Writ development does not require a corresponding consumer update.

The neutral contract contains catalogued corpora, canonical records, structured evidence resources,
Core record links, judgments, exact stored record source and genuine compiler output. It contains no
homepage selections, Lab fixtures, search index, presentation ordering or other web decisions. Large
raw captures such as PDF, HTML and XML files are not repository-mirrored into the bundle unless a
future projection contract explicitly requires them.

The exporter accepts only a clean committed Writ worktree so `metadata.writCommit` identifies the
exact exported state. It performs no network access, model inference, randomness, wall-clock reads or
source mutation. Verification and human acceptance are upstream processes; exporting does not
approve, publish or filter records.

```bash
bun run data:export
bun run data:check
```

The default output is `dist/data/writ-data-bundle.json`. `data:check` generates two local snapshots
and proves that they are byte-identical. CI uses it only to test exporter correctness; CI does not
publish, propagate or update any consumer bundle. Export and downstream replacement are deliberate
operator actions.
