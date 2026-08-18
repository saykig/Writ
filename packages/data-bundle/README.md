# `@writ/data-bundle`

Writ-owned deterministic export of a deliberately chosen canonical repository state. The bundle is
an immutable, read-only snapshot identified by the exact Writ commit and its bundle hash. It is not
a synchronization mechanism. An operator exports it after verification and human review.

The neutral contract contains catalogued corpora, canonical records, structured evidence resources,
Core record links, judgments, exact stored record source and genuine compiler output. It contains no
presentation ordering or interface-specific decisions. Large raw captures such as PDF, HTML and XML
files are not repository-mirrored into the bundle unless a future data contract explicitly requires
them.

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
publish or propagate the bundle. Export remains a deliberate operator action.
