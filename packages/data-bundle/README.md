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

## Exact review-artifact association

Judgment schema `0.3.0` adds an optional native `review_artifact` containing separate `path` and
`content_hash` values. A bundle containing any `0.3.0` judgment uses format `1.1.0`; existing
`0.2.0`-only snapshots retain format `1.0.0` and the original projection. Both formats remain
readable. The original `1.0.0` schema is unchanged.

For each declared binding, ordinary export uses the same repository byte resolver as Writ
verification. It rejects missing files, incorrect hashes, noncanonical paths, path aliases,
symlinks, artifacts absent from the selected repository's Git index and a judgment binding its own
source. Each bound judgment carries a `reviewArtifact`
envelope with `encoding: "base64"` and `content`; the locator and expected SHA-256 remain in the
native `compiledJudgment.review_artifact`. Base64 preserves arbitrary bytes, including an empty
file, without decoding, Unicode normalization or line-ending conversion. Multiple judgments may
carry the same artifact bytes while preserving their separate identities, targets and lineages.

`validateWritDataBundle` recompiles every supported native judgment fragment under its governing
dialect and contract, locates its unique routed whole source resource, and requires canonical
equality of the complete judgment across compiled projection, fragment and whole resource. It then
applies the authoritative supersession validator to the complete reconstructed judgment set. For
bound judgments it also checks decoded bytes with the same pure verifier. Refreshing outer bundle
checksums therefore cannot conceal one-copy changes to judgment semantics or changed artifact bytes
while leaving the binding unchanged. Bound bytes must be present: a locator and hash alone are not
verified content. The pure `@writ/provenance` API reports `unavailable` when only a binding is
supplied. An absent binding on an old or new judgment means only that no exact association is
declared. Advertising an older contract or bundle format cannot erase a binding still declared in
stored judgment source. Binding paths are compared exactly, including their Unicode spelling.

This establishes content association only. Correct bytes do not authenticate a reviewer, prove
authorship, establish evidentiary sufficiency or show that the judgment implements the disposition.
The repository path is a locator within this snapshot, not a portable claim about another
machine's filesystem. Consumers inspect the embedded bytes without resolving that path locally.
Human review remains responsible for semantic agreement and acceptance; adding a binding to an
accepted judgment requires approved successor lineage rather than editing accepted content.
