# `@writ/shared-analysis`

This package owns one bounded lifecycle above the existing decision-case v0.1 boundary:

`import -> attach prior execution -> inspect -> record revision -> assess impact -> explicitly reassess/recompute -> export -> replay`

The portable archive preserves the exact bytes of each separately authored native case. Case-local
analysis, dependency and reference IDs are addressed by `(bundle_id, local_id)` and are never
promoted to global identity. Only the exact triple `(source_id, document_version_id, sha256)` can
establish a shared source version.

The public contract keeps these claims separate:

- the original mathematical subject remains preserved as history;
- original or successor candidate bytes are absent or stored but not yet freshly verified;
- a declared successor subject is identical, changed, not established, or not applicable;
- current evidentiary applicability requires a scope-bound declaration after a changed basis;
- human disposition stays in the underlying case and is not created by this package.

`deriveReassessmentBasis(...)` is the ordinary authoring operation for that declaration. It derives
one analysis-scoped exact identity from the selected prior and any declared successor: subject
hashes, intended use and unit, full relevant dependencies and mappings, exact source references and
source-version hashes, scoped support routes, the revision effect, and declared inventory coverage.
Callers supply only that derived identity plus the reviewer's status and rationale; unchecked
mapping/context hash fields are not part of the portable declaration.

`attachDecisionExecution(...)` accepts the exact bytes of an existing native
`DecisionExecution` for an imported analysis. It attaches only at `revision_id: null`, validates the
existing case, analysis, problem, query, and engine bindings through the decision-case boundary,
and preserves the supplied bytes without running a producer. Recipient replay freshly checks the
preserved candidate just like a recomputed successor.

Support-route IDs remain local to their bundle and each route names the analyses and precise
statement/scope it supports. Revision events are explicit caller-supplied declarations. A metadata
event cannot carry a source, dependency, route, conflict, or subject transition. The package does not select a newer
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
