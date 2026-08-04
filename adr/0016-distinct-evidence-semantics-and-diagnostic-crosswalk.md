# ADR 0016: Distinct evidence semantics and diagnostic crosswalk

**Status:** Accepted

## Context

The shared record schema and the frozen evidence-snapshot schema describe related but distinct
concepts:

- record `basis` says how an assertion is attached, inherited, or inferred;
- evidence `stance` says whether a passage supports, contradicts, qualifies, or only contextualizes
  an assertion;
- `support_type` says which evidentiary function the material performs;
- `truth_value` records an evaluated claim truth state;
- workflow status records a claim or action's process state;
- a reviewed parent decision records the human-reviewed pilot decision; and
- a snapshot review decision records the decision in a frozen evidence snapshot.

The reviewed pilot YAML is the authority for reviewed claims and parent decisions. The frozen
snapshots are historical compatibility inputs for their explicit evidence semantics. Active EU and
US corpus identities are deterministic projections governed by ADR 0014.

Five accepted reviewed claims have no frozen snapshot evidence: `EU-10A`, `EU-10B`, `EU-10C`,
`EU-12`, and `US-02`. The first three correspond to the `EU-10` entry in
`original/provenance/unresolved.json`; the other two correspond to their same-named parent entries.
Missing evidence identity does not reopen or alter their accepted review decisions.

## Decision

### Semantic dimensions stay independent

Values are projected only into the same semantic dimension. Similar labels do not authorize a
mapping:

| Source | Prohibited inference |
| --- | --- |
| `basis: direct` | `support_type: direct` |
| `support_type: derived` | `basis: inferred` |
| `stance: contradicts` | support or `truth_value: false` |
| `stance: qualifies` | support or a truth value |
| `truth_value: unknown` | Boolean false |
| `reviewed_parent_decision: accepted` | `truth_value: true` |
| `snapshot_review_decision: accept` | an active parent-review record |

Absence means that the source does not supply the semantic value. It is not converted to false,
direct, inferred, inherited, or unknown. An explicit source value is preserved independently of
whether a separate identity join succeeds.

The record basis vocabulary remains documented in `schemas/core/record.schema.json` as `direct`,
`inferred`, and `inherited`. Phase 1 does not read record basis or native `.writ` records, so it does
not add a production basis projector. The same-dimension guard proves that basis cannot map to
stance or support type.

The snapshot schema currently requires `stance` and `support_type` in the same evidence link. That
validation rule does not merge their meanings: the diagnostic produces a separate semantic result
for each field.

### Diagnostic statuses

Each semantic dimension and each identity resolution produces a separate result:

| Status | Meaning |
| --- | --- |
| `mapped` | The source explicitly supplies a valid semantic value, or an identity resolves uniquely. |
| `unmapped` | The source supplies no corresponding semantic value or the requested dimensions differ. |
| `unresolved` | A required identity cannot currently be resolved. |
| `error` | Input is invalid, ambiguous, or internally inconsistent. |

Semantic results never require a target identity. Identity results never create semantic values.
Stable reason codes distinguish exact values, absence, semantic non-correspondence, object-specific
not-found and ambiguity cases, missing identifiers, and passage/document inconsistency.

### Separately named review decisions

The diagnostic uses two different projected fields:

- `reviewed_parent_decision`, including the reviewed pilot value `accepted`; and
- `snapshot_review_decision`, including the snapshot review value `accept`.

The 24 active imported parent-review records and 27 frozen snapshot claim reviews are not
interchangeable. A snapshot review resolves only to the object identified by its own `object_type`
and `object_id`; it does not resolve to an active parent-review record.

### Object-specific identity resolution

Identity mappings use the immutable coordinates established by ADR 0014:

| Source object | Target object | Join |
| --- | --- | --- |
| Snapshot claim | Active claim | Snapshot `qualifiers.row_id` to one active `legacy_refs` entry |
| Snapshot passage | Active passage | Snapshot passage ID to one active `legacy_refs` entry |
| Snapshot document version | Active source | Document-version ID to one active `legacy_refs` entry |
| Snapshot review | Its snapshot-reviewed object | Snapshot-local `object_type` and `object_id` |

A passage mapping additionally checks that its resolved active passage names the source machine ID
for the snapshot passage's document version when that document version resolves uniquely. A
mismatch is an error; no identity or semantic value is silently repaired.

The complete evidence-crosswalk coverage is:

- 27 frozen snapshot claims resolve to active claims;
- 22 frozen passages resolve to active passages;
- 10 frozen document versions resolve to active sources;
- 27 frozen snapshot reviews resolve to snapshot claim objects; and
- five accepted reviewed claims produce separate unresolved evidence-identity results.

This is distinct from the corpus-migration invariant that all 38 reviewed parent/claim legacy
references resolve exactly once. The diagnostic crosswalk does not claim evidence coverage for all
38 migration references.

### Unresolved evidence identities

The diagnostic expands unresolved provenance per accepted atomic claim:

| Claim | Unresolved provenance row | Result |
| --- | --- | --- |
| `EU-10A` | `EU-10` | `unresolved / EVIDENCE_IDENTITY_NOT_AVAILABLE` |
| `EU-10B` | `EU-10` | `unresolved / EVIDENCE_IDENTITY_NOT_AVAILABLE` |
| `EU-10C` | `EU-10` | `unresolved / EVIDENCE_IDENTITY_NOT_AVAILABLE` |
| `EU-12` | `EU-12` | `unresolved / EVIDENCE_IDENTITY_NOT_AVAILABLE` |
| `US-02` | `US-02` | `unresolved / EVIDENCE_IDENTITY_NOT_AVAILABLE` |

Each claim retains a separate exact `reviewed_parent_decision: accepted` result. No substantive,
truth, workflow, or review field changes.

### Result boundary

The Phase 1 result is an internal, read-only diagnostic compatibility projection. It is:

- not a native `.writ` record;
- not a canonical Core schema;
- not a public interchange contract;
- not a persisted corpus artifact; and
- not an input to corpus generation, mutation, or migration.

The adapter reads frozen and active files but performs no writes, network access, model inference,
randomness, or wall-clock reads. Results are sorted deterministically by stable source identity and
then by complete source pointer, passage ID, and evidence-link position. Those final coordinates
keep ordering stable when a claim contains multiple evidence links.

Core schemas do not depend on this adapter. `record.schema.json` and `evidence.schema.json` remain
separate, and no shared schema is introduced because their evidence vocabularies are not duplicate
semantics. Institutional and legal-policy contracts remain family profiles. AI governance remains
a corpus topic, and queries do not define corpus identity. Generated schema copies remain
non-authoritative and unchanged.

## Consequences

- Compatibility diagnostics can expose missing or conflicting identity information without
  changing reviewed knowledge.
- Explicit stance, support, truth, workflow, and review values survive an unrelated identity
  failure.
- `US-02` and the four EU claims remain accepted while their missing snapshot evidence stays
  visible.
- Phase 1 can be reverted without migrating sources or changing valid `.writ` records.
- Any future native language or schema reconciliation requires a separate task and decision.
