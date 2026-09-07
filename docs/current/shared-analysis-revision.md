# Shared analyses and explicit revision

## Boundary

`@writ/shared-analysis` extends the bounded decision-case handoff from PR 43. It imports separately
authored native cases that share exact source versions, exposes their distinct modelling premises,
processes explicit source or assumption events, and produces a portable record another recipient can
reconstruct and freshly check.

The package does not merge the native cases into a master case. Original bytes remain embedded in
the archive, and native local IDs are always addressed with a bundle ID. It does not infer a current
source version, statistical dependence, real-world applicability, human approval, or a preferred
analyst.

## Public lifecycle

The library path is:

1. `importSharedAnalyses(workspaceId, bundles)` validates each complete native case and exact source
   bytes, scopes local IDs, deduplicates exact repeat imports, and refuses bundle or source/version
   conflicts.
2. `inspectSharedAnalyses(workspace)` derives shared exact sources and explicit assumption/model
   differences. It reports unmapped comparisons as `not_established`.
3. `recordRevision(workspace, declaration)` appends one explicit source, withdrawal, assumption, or
   metadata event. Prose and version labels never create an event.
4. `assessRevision(workspace, revisionId)` reconstructs direct/downstream paths and reports prior
   mathematical validity, successor-check reuse, current applicability, alternative routes,
   conflicts, and inventory limits separately.
5. `reassessApplicability(workspace, declaration)` records a declaration bound to the exact impact
   basis. `recomputeAnalysis(...)` refuses to run a successor without it, then uses the existing
   pinned Decision Lab runner and preserves the checked execution bytes.
6. `exportSharedAnalysis(workspace)` emits exact portable JSON. `openSharedAnalysis(bytes)` validates
   it. `replaySharedAnalysis(bytes, engineOptions)` reconstructs impacts and freshly checks every
   preserved candidate.

The recipient CLI is intentionally narrow because importing and revision selection are caller
policy:

```bash
bun packages/shared-analysis/bin/writ-shared-analysis.ts replay \
  --archive /path/to/shared-analysis.json \
  --engine-root /path/to/pinned/writ-decision-lab \
  --python /path/to/cpython-3.13-with-scipy-1.17/bin/python
```

It prints one standard-JSON replay report and does not mutate the archive, engine checkout, or
source cases.

## Meaning of revision results

- `affected` means an explicit changed or withdrawn input has an observed direct/transitive path, or
  a declared successor changes the exact subject.
- `unaffected` is available only when the bundle declares the bounded inventory complete and no
  path/change exists.
- `not_established` means no path was observed but the supplied inventory is partial or unknown.
- `original_mathematical_check_valid` says only that the old result remains about its old exact
  bytes.
- `mathematical_check_reusable` is true only when a declared successor has the same problem/query
  bytes, or a metadata-only event changes no theorem.
- `applicability_requires_reassessment` is independent of both fields above.

Within a support route every source premise is required. Distinct complete routes for one identical
statement and scope are alternatives. A surviving route remains conditional support; it cannot
silence contradictory current input. Native dependency graphs must be acyclic, and supplemental
routes can begin only from source identities, so circular self-support is not expressible.

## Proving ground and limits

The checked-in alpha and beta cases are synthetic. Alpha explicitly assumes independence and beta
does not. Shared bytes do not create that assumption. The full fixture and its exact expected
mathematics are documented in `decision-cases/shared-analysis-revision/README.md`.

The profile remains limited to the existing `finite-linear-uncertainty.v1` decision and
compatibility operations. It adds no conditional, causal, sequential, strategic, safety, or
authority-to-act meaning. ADR 0028 is Proposed; implementation does not constitute acceptance.
