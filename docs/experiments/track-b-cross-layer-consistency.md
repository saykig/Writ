# Track B cross-layer consistency discovery

## Baseline and boundary

The experiment began from clean local and remote `main` at exact merged PR #40 commit
`681016a24f734438895ae1758f0caf5c0bd9e5a7`. Work remained on
`codex/track-b-gauntlet`; no external systems, credentials, unrelated repositories or network
security mechanisms were exercised.

The evaluated boundary remained source -> passage -> typed record/link -> human judgment ->
provenance -> deterministic portable representation. No decision object, scientific case, ontology
or review-artifact semantic was added.

## Method

Four provisional reviewers independently proposed small local cases. Serious candidates required a
second representation or reviewer to confirm them before classification. Tests used production
parsing, formatting, compilation, schema/domain validation, repository loading, all four verifier
gates, ordinary bundle generation, schema/reload validation and deterministic regeneration.
Synthetic changes were made in temporary directories or in-memory bundles, and ordinary section and
bundle hashes were recomputed when transport hashes were not the invariant under test.

A disposable harness ran an unchanged NIST record module and repository through the production entry
points. It reported parser, idempotent formatter, compiler, domain contract, repository loader,
ontology, interoperability, provenance, integrity, export/reload and deterministic regeneration all
passing. The exported NIST view contained 14 non-superseded and 6 superseded records, plus 22 accepted
and 7 superseded judgments; the harness was then deleted.

## Differential layer matrix

| Candidate | Syntax / object schema | Authoritative production behavior | Baseline portable or domain behavior | Classification | Result |
| --- | --- | --- | --- | --- | --- |
| Valid `0.2.0` record or judgment requested as `9.9.9` | Payload valid for its actual contract | Exact registry lookup: unsupported | `validateVersion`: pass via current-validator fallback | `CONTRACT_VERSION_DEFECT` | Repaired |
| Change only a record projection, compiled value, retained fragment or routed whole source; rehash | Individual forms remain well-formed | Projector derives one exact record | Reload accepted disagreeing forms | `EXPORT_RELOAD_DIVERGENCE` | Repaired |
| Change only link projection/value/source or reactivate status; rehash | Link contract remains valid | Link projector derives one exact link | Reload accepted disagreement | `EXPORT_RELOAD_DIVERGENCE` | Repaired |
| Change a routed source version while record evidence remains old; rehash | Source remains syntactically valid | Evidence resolution rejects old version | Reload accepted | `EXPORT_RELOAD_DIVERGENCE` | Repaired |
| Replace an embedded source SHA while retaining exact content; rehash | Hash remains shape-valid | Raw byte hash disagrees | Reload accepted | `EXPORT_RELOAD_DIVERGENCE` (source-envelope identity manifestation) | Repaired |
| Duplicate a corpus and its matching record/link arrays; rehash | Each object remains individually valid | Global canonical keys are not unique | Per-corpus reload replay accepted | `EXPORT_RELOAD_DIVERGENCE` within the same portable representation repair | Repaired |
| Parser recovery versus compiler/schema rejection | Parser may retain a recoverable AST | Compiler/schema own semantic validity | Different result is intentional | `EXPECTED_LAYER_BOUNDARY` | Unchanged |
| Rehash a coherently changed exported snapshot | Structurally valid new snapshot | Git checkout establishes committed completeness | Portable reload proves internal agreement, not authorship or Git-tree completeness | `EXPECTED_LAYER_BOUNDARY` | Documented limitation |

## Strongest counterexamples and repairs

### 1. Exact contract version fallback

At baseline, `resolveSchemaVersion(kind, "9.9.9")` returned `undefined`, yet
`validateVersion` passed current-shaped institutional records and `0.2.0` judgments. A bound `0.3.0`
judgment failed only because the fallback `0.2.0` shape rejected it, not because the requested version
was unknown. Contract and provenance reviewers independently reproduced this.

Commit `08a353d` makes exact registry resolution the dispatch boundary. Unsupported requests throw
typed `UnsupportedSchemaVersionError` with stable code `DOMAIN_SCHEMA_VERSION_UNSUPPORTED`; supported
`0.1.0`, `0.2.0` and judgment `0.3.0` behavior is unchanged.

### 2. Portable retained-representation divergence

At baseline, a fully rehashed bundle could independently change native record status, compiled nested
evidence, stored record fragments, routed whole record resources, record-link projections/values,
source-version resolution, or a source envelope's claimed hash. A coherent duplicate corpus plus
matching duplicate record/link arrays also passed. Authoritative projection either derived different
objects or rejected the state. Export, contract, provenance and independent reviewers confirmed
different members of this single missing non-judgment replay boundary.

Commit `d1f2f60` introduces one shared bundle resource reader seam in the existing production
projector. Reload now:

- parses and exactly reconciles catalog, corpus and manifest representations;
- rejects duplicate corpus/resource identities and reuses the exporter's global canonical-object key
  check;
- reconstructs complete record and record-link arrays from bundle-routed resources and compares them
  with exact structural equality;
- resolves record evidence through the same routed source metadata used by ordinary export; and
- recomputes every embedded `BundleSource.sha256` from exact content.

Object property insertion order remains irrelevant, array order and string spelling remain exact, and
canonical JSON/hash identities are unchanged. The repair applies to existing supported native and
compatibility record contracts under bundle `1.0.0` and `1.1.0`. Judgment reconstruction,
supersession validation, exact artifact binding and human disposition remain the PR #40 mechanisms.

## Permanent protection

- Domain regressions require exact supported-version dispatch for current record and judgment shapes.
- Data-bundle regressions cover projected/compiled/stored/routed record disagreement, nested evidence,
  record-link value and status disagreement, routed source-version drift, false source hashes, stale
  catalog projection and coherent duplicate corpora after all ordinary outer hashes are refreshed.
- Existing judgment `0.2`/`0.3`, bundle `1.0`/`1.1`, Unicode identity, full-judgment equality,
  supersession lineage and exact review-artifact byte tests remain the controls.

## Role performance

All four roles are retained unchanged provisionally. Contract / Schema uniquely isolated exact-version
fallback. Export / Interoperability found the main record/link replay generalization and the reusable
production seam. Provenance found source-hash and source-version attachment variants and verified NIST
preservation. Independent Counterexample found the complete-set duplicate-corpus bypass. There was
useful overlap on the two root causes, but one experiment is insufficient evidence to merge or retire
a role. Unconfirmed serendipitous candidates were not promoted to findings or role instructions.

## Deliberate non-generalizations and limitations

The repair does not authenticate a recomputed bundle, prove completeness against its claimed Git tree,
recover excluded raw captures, or prove that an unreferenced file existed before a coherently changed
snapshot. It does not add record supersession machinery, a current/history object, a fifth role, or a
portable clone of the four-gate repository verifier. Those are distinct responsibilities.

Two serendipitous observations were stopped without classification after the two-repair gate: duplicate
singular judgment members accepted by the grammar/compiler, and corpus scoping of historical migration
targets in provenance verification. They require fresh independent confirmation before being treated
as defects.

## Acceptance status

The full local acceptance gate passed on the completed implementation and report:

- formatting, lint, all workspace typechecks and the full Bun suite;
- clean deterministic export/reload: 81 records, 16 links and 65 judgments, byte-identical at
  `sha256:dafd4d65e3fd0626f36fae349080708cda32f528485a0e1e068aa6adb75796a5`;
- Writ ontology, interoperability, provenance and integrity verification with zero errors and zero
  warnings; and
- all workspace builds.

The focused data-bundle suite passed 50 tests with 913 expectations, and both independent post-fix
reviewers reported no remaining blocker in the repaired boundaries. Draft-PR CI is recorded at final
handoff.

The two independently confirmed generic defects are minimally repaired. The substrate should not
begin the bounded scientific transfer test until one focused follow-up independently classifies the
remaining historical-target scoping observation; no scientific case was selected or implemented
here.
