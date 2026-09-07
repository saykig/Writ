# `@writ/shared-analysis`

This package owns one bounded lifecycle above the existing decision-case v0.1 boundary:

`import -> inspect -> record revision -> assess impact -> explicitly reassess/recompute -> export -> replay`

The portable archive preserves the exact bytes of each separately authored native case. Case-local
analysis, dependency and reference IDs are addressed by `(bundle_id, local_id)` and are never
promoted to global identity. Only the exact triple `(source_id, document_version_id, sha256)` can
establish a shared source version.

The public contract keeps four claims separate:

- the old calculation remains valid for its original exact problem/query bytes;
- a calculation is or is not reusable for a successor mathematical subject;
- current evidentiary applicability requires a scope-bound declaration after a changed basis;
- human disposition stays in the underlying case and is not created by this package.

Revision events are explicit caller-supplied declarations. The package does not select a newer
source from a label or date, infer numbers from prose, infer statistical dependence from lineage,
or treat a stored checked flag as authoritative. Derived inspections and revision impacts are
reconstructed rather than serialized as a second history.

Recipient replay uses the exact stored candidate and the pinned checker; it does not rerun the
producer and substitute a new result. Archives must use the authoritative JSON Schema and the
deterministic exact-JSON byte representation. The local lineage index is reconstructed from native
dependencies and is never portable authority.

The public recipient command is:

```bash
bun packages/shared-analysis/bin/writ-shared-analysis.ts replay \
  --archive /path/to/shared-analysis.json \
  --engine-root /path/to/pinned/writ-decision-lab \
  --python /path/to/cpython-3.13-with-scipy-1.17/bin/python
```
