# ADR 0028: Add a portable shared-analysis revision boundary

**Status:** Accepted

## Context

Accepted ADR 0026 and the implementation merged through PR #43 establish one bounded handoff: an
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

PR #47 implemented the candidate architecture, compared native and reuse-oriented approaches,
selected the smaller native lifecycle plus a narrow Aldera-derived lineage index, and then survived
two rounds of semantic hardening. The human gate now accepts that bounded architecture.

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

## Decision

Use a separate `@writ/shared-analysis` package and a versioned
`shared-analysis-revision-v0.1.schema.json` portable archive. Use the native candidate's smaller
public lifecycle and validation shape, together with the reuse candidate's separately tested
deterministic lineage mechanism for declaration conflicts, complete lexical path enumeration, and
cycle refusal. Decline Aldera's dataset/store authority model and the reuse candidate's larger
parallel contract implementation. The implementation report records the exact common, candidate,
and consolidated commits.

The archive contains only exact imported case bytes, selected local analysis IDs, bounded inventory
declarations, supplemental source bytes, explicit revision events, scope-bound applicability
declarations, and exact execution bytes. Derived graphs, shared-source inspection, revision impacts,
and stored success flags are not portable authority; recipients reconstruct them.

Case-local IDs are addressed by `(bundle_id, local_id)`. Support routes likewise use
`(bundle_id, route_id)`, explicitly name the selected local analyses they support, and retain their
statement ID and scope in impact output. A shared source version exists only when
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

Every revision is a supplied event. Metadata events are structurally restricted to metadata-only
content and cannot suppress reassessment for a substantive event. Writ never selects a source
version from a title or date and never extracts a probability from prose. Impact reporting keeps
these separate:

1. the prior exact subject remains preserved, without implying that check evidence exists;
2. stored candidate evidence remains unverified until recipient replay, and a declared successor
   is classified as an identical, changed, unestablished, or inapplicable subject;
3. changed source, assumption, mapping, or context basis needs a new applicability declaration;
4. human disposition remains the immutable native case declaration.

The public basis derivation binds an applicability declaration to its exact selected prior and any
declared successor: mathematical subject, intended use, unit, exact source/reference material,
full assumptions, mappings, derivation declarations, relevant route scopes, revision effect, and
inventory coverage. Human disposition, display metadata, workspace labels, and unrelated analyses
are excluded. The declaration carries that derived identity plus exact source and assumption
addresses; it has no caller-invented mapping/context digest fields. It is not authenticated review
or proof of empirical truth. `recomputeAnalysis`
requires that declaration and then uses ADR 0026's pinned runner. Recalculation cannot manufacture
applicability. Recipient replay parses the archive, reconstructs every impact, and freshly checks
each stored numerical candidate through the existing adapter. Its result identifies the revision,
execution, case, analysis, problem, query, and candidate hashes rather than relying on array order.

An existing native `DecisionExecution` may be attached to an imported original analysis at
`revision_id: null`. Attachment preserves the supplied exact execution bytes and validates their
case, selected analysis, problem, query, analysis binding, and engine through the existing
decision-case boundary. It does not run the producer or establish current applicability. Recipient
replay freshly checks that preserved original candidate alongside any successor candidates.

Cross-analysis model equality ignores bundle-local analysis/dependency/reference identifiers and
lifecycle bookkeeping such as applicability, human review, predecessor, analysis kind, and change
history. It compares the exact mathematical subject, ID-independent dependency graph declarations,
model mappings, referenced material, engine semantics, question, intended use, prohibited uses, and
unit. Exact modelling-choice differences remain separately reported by their scoped local
addresses.

## Acceptance evidence

The decision is accepted after PR #47 demonstrated and hardened the full public lifecycle:

- independently authored alpha/beta analyses preserve colliding local IDs and differing modelling
  premises without flattening disagreement;
- exact shared evidence is distinguished from independence, causality, and authority;
- source, assumption, route, and successor changes propagate through scoped dependency paths;
- reassessment is bound mechanically to the exact selected source/assumption/model/use basis rather
  than caller-supplied summary hashes;
- local bookkeeping and identifier differences no longer create false model disagreement;
- original executions and successor executions coexist immutably and are freshly checked by a
  recipient without producer rerun;
- metadata relabelling cannot hide a substantive revision, incomplete ancestry never becomes
  optimistic `unaffected`, and target validity remains separate from current applicability.

The accepted value is the portable revision/replay boundary and its fail-closed semantics. It is not
a claim that the synthetic cases are representative, that lineage implies dependence, or that every
future mathematical result belongs in this archive.

## Consequences and limits

- PR #43's native case and execution schemas and historical fixtures remain unchanged.
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
