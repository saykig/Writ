# ADR 0028: Add a portable shared-analysis revision boundary

**Status:** Proposed

## Context

Proposed ADR 0026 and the implementation merged through PR 43 establish one bounded handoff: an
exact source-grounded decision case can be run through a pinned producer/checker, preserved, and
freshly checked by a recipient. They do not answer the next interoperability question: how should a
caller combine separately authored cases that share evidence, retain their different modelling
premises, declare a source or assumption revision, and determine which prior uses require
reassessment or recomputation?

That operation must not make analyses into corpus records, make questions first-class knowledge
objects, or infer empirical truth from a dependency edge. A shared source link says where supplied
content came from. It does not establish statistical independence, causality, reviewer authority,
or agreement between analysts.

The proving ground has two synthetic native v0.1 cases. Alpha adds an independence premise and beta
leaves dependence unspecified. Their case-local IDs deliberately collide. They share exact source
bytes and losses, but their checked answers differ legitimately. Explicit source-only,
quantitative, and assumption-withdrawal events exercise applicability and calculation changes.

This ADR remains proposed pending human architectural disposition. The implementation and its PR do
not accept it automatically.

## Options considered

### 1. Native direct traversal inside the new package

The shared layer can index each selected native analysis, walk its dependency arrays directly, and
compute paths for each revision. This has the smallest attribution surface and no new runtime
dependency. It risks mixing validation, identity, traversal, and revision policy in one bespoke
module unless the graph mechanism is kept sharply separated.

### 2. Adapt a deterministic lineage-graph mechanism

Aldera commit `9b7d05e9fb2ed11c315e9b6a1dca66e3a8aa9eb4` contains small deterministic graph construction and
ancestry/path traversal mechanisms, explicit scope/coverage handling, and deduplication. Those
mechanisms can be adapted under Apache-2.0 into Writ and tested against this different semantic
domain. Aldera's dataset contract, store, dataset identity, and Writ-provenance mirror do not fit and
must not be copied. Writ remains responsible for source identity, decision-case validation,
revision semantics, and applicability.

### 3. Adopt a general incremental/workflow system

Salsa supplies incremental deterministic query machinery but would add a Rust database/runtime and
memoization boundary without a measured workload benefit. DVC supplies declared file-stage
dependencies and reruns but its output/cache/lock mutation does not express evidentiary
applicability or portable semantic reassessment. AiiDA would add a substantial service and database
surface. W3C PROV-DM provides useful meanings for derivation, revision, and alternate entities, but
is a specification rather than an execution engine. None removes enough Writ-owned semantics to
justify adoption for this bounded operation.

## Proposed decision

Use a separate `@writ/shared-analysis` package and a versioned
`shared-analysis-revision-v0.1.schema.json` portable archive. Select the smallest candidate that
passes the frozen lifecycle contract; when the reuse-oriented candidate remains comparably small,
prefer its separately tested deterministic lineage mechanism while declining its dataset/store
semantics. Record the exact selected candidate in the implementation report before review.

The archive contains only exact imported case bytes, selected local analysis IDs, bounded inventory
declarations, supplemental source bytes, explicit revision events, scope-bound applicability
declarations, and exact execution bytes. Derived graphs, shared-source inspection, revision impacts,
and stored success flags are not portable authority; recipients reconstruct them.

Case-local IDs are addressed by `(bundle_id, local_id)`. A shared source version exists only when
`source_id`, `document_version_id`, and exact SHA-256 all match. Equal labels and equal bytes under
different declared identities do not prove sameness or independence. Conflicting bytes for one
declared source/version fail closed.

Dependency inventory is explicitly `complete`, `partial`, or `unknown` for a declared scope. A
complete inventory with no path can establish `unaffected`; a partial or unknown inventory with no
observed path yields `not_established`. Native dependency cycles remain invalid. Supplemental
support routes contain source premises only, so self-support cannot be represented. All premises
inside one route are conjunctive; complete routes for the identical statement and scope are
alternatives. One surviving route provides conditional support but does not erase a current
contradictory premise.

Every revision is a supplied event. Writ never selects a source version from a title or date and
never extracts a probability from prose. Impact reporting keeps these separate:

1. the prior check remains valid for its original exact subject;
2. a successor with changed problem/query bytes needs a new calculation;
3. changed source, assumption, mapping, or context basis needs a new applicability declaration;
4. human disposition remains the immutable native case declaration.

An applicability declaration binds the exact revision-impact basis, sources, assumptions, mappings,
and context. It is not authenticated review or proof of empirical truth. `recomputeAnalysis`
requires that declaration and then uses ADR 0026's pinned runner. Recalculation cannot manufacture
applicability. Recipient replay parses the archive, reconstructs every impact, and freshly checks
each stored numerical candidate through the existing adapter.

## Consequences and limits

- PR 43's native case and execution schemas and historical fixtures remain unchanged.
- Corpora and native records remain independent of shared workspaces, questions, and presentations;
  NIST remains the sole active knowledge proving ground.
- The archive is portable across processes but requires the declared Writ code, pinned Decision Lab
  source, CPython 3.13, and `scipy==1.17.0` for recomputation or fresh candidate checking.
- `model_dependent` remains a valid checked result and is never collapsed into `unresolved`.
- The direct-files baseline is mathematically equal when its operator supplies and checks the same
  exact subjects. The package earns repeatable scoping, conflict refusal, bounded impact paths,
  explicit reassessment, and recipient replay—not a claim of empirical correctness or productivity.
- This decision does not add automatic belief revision, arbitrary execution, a service/database,
  causal or sequential methods, reviewer authentication, or authority to act.
