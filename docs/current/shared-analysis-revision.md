# Shared analyses and explicit revision

## Boundary

`@writ/shared-analysis` extends the bounded decision-case handoff from PR 43. It imports separately
authored native cases that share exact source versions, exposes their distinct modelling premises,
processes explicit source or assumption events, and produces a portable record another recipient can
reconstruct and freshly check.

The package does not merge the native cases into a master case. Original bytes remain embedded in
the archive, and native local IDs are always addressed with a bundle ID. It does not infer a current
source version, statistical dependence, real-world applicability, human approval, or a preferred
analyst. ADR 0028 is **Accepted** for this bounded lifecycle.

## Public lifecycle

The library path is:

1. `importSharedAnalyses(workspaceId, bundles)` validates each complete native case and exact source
   bytes, scopes local IDs, deduplicates exact repeat imports, and refuses bundle or source/version
   conflicts.
2. `attachDecisionExecution(workspace, analysis, bytes)` preserves an existing exact native
   execution at `revision_id: null` only after the decision-case boundary verifies its exact case,
   analysis, problem, query, and engine bindings. It does not solve or refresh applicability.
3. `inspectSharedAnalyses(workspace)` derives shared exact sources and compares exact assumption,
   model, subject, intended-use, and unit declarations. Matching local labels alone establish
   nothing; bundle-local analysis/reference/dependency IDs and applicability, human review, and
   revision-history bookkeeping do not create model disagreement. Comparisons without a shared
   exact source remain `not_established`.
4. `recordRevision(workspace, declaration)` appends one explicit source, withdrawal, assumption, or
   metadata event. Prose and version labels never create an event.
5. `assessRevision(workspace, revisionId)` reconstructs direct/downstream paths and reports the
   preserved original subject, available historical candidate evidence, successor-subject status,
   current applicability, statement-scoped alternative routes, conflicts, and inventory limits
   separately. Semantic dependency roles, not fixture ID spellings, identify subject/check nodes.
6. `deriveReassessmentBasis(workspace, revisionId, analysis)` derives the exact reviewable basis from
   the selected prior and any declared successor. It covers subject hashes, intended use, unit,
   relevant exact source/reference declarations, assumption addresses and contents, mappings,
   derivation declarations, route scope, revision effect, and inventory completeness. It excludes
   human disposition, display title, workspace label, and unrelated analyses.
7. `reassessApplicability(workspace, declaration)` records a declaration whose basis, exact source
   bindings, and assumption addresses must equal that derived basis. `recomputeAnalysis(...)`
   refuses to run a successor without it, then uses the existing pinned Decision Lab runner and
   preserves the checked execution bytes.
8. `exportSharedAnalysis(workspace)` emits exact portable JSON. `openSharedAnalysis(bytes)` validates
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

## Bounded certificate-transport extension

The current engineering trial adds a separate `certificate_transport_integration` record rather
than changing the accepted shared-analysis archive into a generic mathematical-result container.
The record embeds the exact shared-analysis archive and binds one affected revision to:

- the current supported reassessment basis;
- the exact prior and target analysis identities;
- an explicit caller-supplied mapping from that revised basis to actual changed fields in a pinned
  Bellman certificate-transport request;
- the preserved source certificate, transported target certificate, and their exact hashes;
- the exact producer candidate and producer-time checker report.

The integration does not infer that the mapping declaration is empirically or substantively true.
It checks that every declared request field resolves on both source and target and actually changed,
and it refuses no-op or label-only transports. Descriptive `name` and `premises` paths cannot stand
in for a mathematical model or policy field even when some other request content changed. The
model-to-request mapping remains an explicit review premise.

`replayCertificateTransportRecord(...)` reopens the embedded PR 47 archive, revalidates the exact
revision/reassessment binding, and invokes only the pinned transport checker on the stored request
and evidence. A stored producer-time check is not authority. The fresh replay preserves Decision
Lab's distinction between an ordinary target certificate and the stronger warrant that the target
certificate was validly transported from the old checked source certificate. It verifies the fresh
check's request/evidence hashes against the supplied bytes and derives source-certificate status
from the exact checker order; it never repeats a stored `checked` label unconditionally.

The acceptance review retains this extension only as a revision-bound checked mathematical
transition. It is not permission to port certificate accumulation or another Bellman component
automatically.

## Meaning of revision results

- `affected` means an explicit changed or withdrawn input has an observed direct/transitive path, or
  a declared successor changes the exact subject.
- `unaffected` is available only when the bundle declares the bounded inventory complete and no
  path/change exists.
- `not_established` means no path was observed but the supplied inventory is partial or unknown.
- `original_subject_status: preserved` records history without claiming a check occurred.
- original and successor check evidence is `absent` or `stored_candidate_unverified`; only explicit
  recipient replay establishes a fresh check of exact candidate/subject bytes.
- successor subject status is `identical_subject`, `changed_subject`, `not_established`, or
  `not_applicable`. No transition defaults to `not_established` for an affected or incompletely
  inventoried analysis, never optimistic reuse.
- `applicability_requires_reassessment` remains independent of those statuses.

Within a support route every source premise is required. Distinct complete routes for one identical
statement and scope are alternatives. Route identity is `(bundle_id, route_id)`, and each route
explicitly names its selected local analyses. A route for another statement or analysis is not an
alternative. A surviving route remains conditional support; it cannot silence contradictory current
input. Native dependency graphs must be acyclic, and supplemental routes can begin only from source
identities, so circular self-support is not expressible.

A `metadata_change` event must contain no source replacement/withdrawal, assumption withdrawal,
route withdrawal, conflicting premise, or successor transition. That makes its non-reassessment
status structural rather than caller-label based.

## Proving ground and limits

The checked-in alpha and beta cases are synthetic. Alpha explicitly assumes independence and beta
does not. Shared bytes do not create that assumption. The full fixture and its exact expected
mathematics are documented in `examples/decision-cases/shared-analysis-revision/README.md`.

The accepted shared-analysis profile remains limited to the existing `finite-linear-uncertainty.v1`
decision and compatibility operations. The certificate-transport trial adds one separately pinned
sequential guarantee operation; it does not add conditional, causal, strategic, safety, empirical
validation, authenticated review, or authority-to-act meaning.
