# Schema authority

`schemas/` is the only active JSON Schema authority for Writ. All authoritative schemas use JSON
Schema 2020-12. Files under `packages/domain/schemas/` are generated, drift-guarded vendor copies
for runtime packaging; they are not a second authority.

The Git-tagged EU-US pilot snapshot keeps three local schemas in its historical tree. Those
contracts are `historical pilot-local`: they govern only that preserved snapshot and are not active
global Writ schemas. Its exact tag, path, and recovery command are indexed in
[`docs/history/snapshots.md`](../docs/history/snapshots.md).

## Dependency direction

```text
core
  ↑
extensions
  ↑
analysis
```

- Core contracts cannot depend on extensions, analysis, or compatibility contracts.
- Family extensions may depend only on core.
- Analysis contracts may depend on core and named extensions.
- Compatibility families are isolated versioned contracts. Retained secondary corpora may declare
  them exactly; new core or extension schemas must not depend on them.
- Pilot-local contracts remain self-contained.

Family-specific fields are never required globally. A legal record may require legal force and an
institutional record may require a fact-specific payload; those requirements belong to their
family, not the shared core.

The native institutional v0.2 operational-capacity branch is finalized by ADR 0018. It represents
one atomic capacity with controlled status and capacity type, stable component identifiers, optional
time-qualified quantity, and evidence references. The prior `dimensions` payload remains available
only through the frozen v0.1 compatibility contract and parser path.

## Current core schemas

| Schema                               | Classification | Responsibility                                                                                                                                               |
| ------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `core/evidence.schema.json`          | core           | Frozen source versions, passages, claims, relationships embedded in evidence actions, reviews, and snapshot provenance.                                      |
| `core/source-registry.schema.json`   | core           | Generated source-registry interchange document.                                                                                                              |
| `core/corpus_vocabulary.schema.json` | core           | Reviewed controlled-vocabulary mappings shared by corpus adapters.                                                                                           |
| `core/record.schema.json`            | core           | Closed public record envelope plus the composable `recordBase`: identity, structured subjects, scope, evidence, uncertainty, provenance, and workflow state. |
| `core/corpus-manifest.schema.json`   | core           | Native corpus identity, family, boundary, locations, counts, and the declared record contract.                                                               |
| `core/corpus-catalog.schema.json`    | core           | Stable corpus-ID-to-path resolution for native corpora, plus the retired-corpus migration ledger.                                                            |
| `core/record-link.schema.json`       | core           | Family-neutral, directed record relationships with independent evidence and review state.                                                                    |

No core schema requires a commitment, obligation, compliance result, or score.

## Family extensions

`extensions/` is the authority location for native family profiles. The implemented profiles are
`legal_policy` and `institutional`. Record judgments are analysis objects rather than family
extensions. The classification and dependency rules are recorded in
[`extensions/README.md`](./extensions/README.md).

## Human-review schemas

| Schema                                 | Classification | Responsibility                                           |
| -------------------------------------- | -------------- | -------------------------------------------------------- |
| `analysis/record-judgment.schema.json` | human review   | Independent judgments targeting a record or record link. |

## Derived decision-case schemas

| Schema                                               | Classification   | Responsibility                                                                                                                                               |
| ---------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `analysis/decision-case-v0.1.schema.json`            | derived analysis | Portable case, exact source bytes/spans, model mappings, dependency DAG, immutable revisions and intended uses.                                              |
| `analysis/decision-execution-v0.1.schema.json`       | derived analysis | Byte-bound untrusted candidate plus separately recorded mathematical check, applicability and human disposition.                                             |
| `analysis/shared-analysis-revision-v0.1.schema.json` | derived analysis | Exact imported case bundles, bounded inventories, explicit revisions, scope-bound applicability declarations, and preserved executions for recipient replay. |

The case and execution contracts implement the bounded candidate in proposed ADR 0026. The shared
revision envelope is proposed by ADR 0028 and composes those exact native cases without merging them
into a corpus or master case. These are not Core or family record contracts, cannot appear as a
corpus `record_contract`, and do not make a computation a source of truth. A recipient must freshly
check an execution against independently reopened intended bytes; a stored check status does not
become authorization.

### Declared record contracts

Every corpus manifest declares one `record_contract`:

```yaml
record_contract:
  kind: native | compatibility
  id: <authoritative contract $id>
  version: <contract version>
```

`kind` states whether the files are a native Writ family grammar or a preserved
compatibility format, and `id` names the contract every file listed in `locations` is
validated against. A corpus holding an imported payload declares `compatibility` and names
the contract that actually validates it. A manifest never advertises a native grammar its
own record files cannot satisfy, and a manifest whose structure is valid does not pass if
its record files fail the contract it names.

### Workflow vocabularies

Two vocabularies are deliberately distinct and are never mixed:

| Concept                      | Field          | Values                                                     |
| ---------------------------- | -------------- | ---------------------------------------------------------- |
| Record or record-link review | `review_state` | `draft`, `reviewed`, `approved`, `superseded`, `withdrawn` |
| Judgment disposition         | `status`       | `proposed`, `accepted`, `contested`, `superseded`          |

`accepted` is a judgment status, not a record or record-link review state. Accepting a
judgment does not move its target through review; record acceptance is expressed with the
`review_disposition` and `record_link_disposition` judgment types rather than by overloading
an unrelated judgment type.

v0.2 judgment supersession is directional: an accepted judgment lists what it replaced in
`supersedes_judgment_ids`, and a superseded judgment names its replacement in
`superseded_by_judgment_id`. Self-supersession and cycles are rejected by
`validateJudgmentSupersession` in `@writ/domain`. The v0.1 judgment contract keeps its
original undirected `supersedes` field unchanged.

## Compatibility-only schemas

| Schema family                                                             | Classification     | Status                                                                                                                               |
| ------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `compatibility/compliance-corpus-v2/*.schema.json`                        | compatibility-only | Dormant legacy ingestion contracts. No active corpus, data-bundle path, or verifier adapter consumes their compliance record shapes. |
| `compatibility/record-grammar-v0.1/*.schema.json`                         | compatibility-only | Frozen v0.1 base, legal-policy, institutional-profile, and record-judgment contracts.                                                |
| `compatibility/eu-us-ai-reviewed-v1/reviewed-corpus-document.schema.json` | compatibility-only | Exact retained contract for reviewed secondary EU/US legal-policy corpora; not the native legal-policy grammar.                      |

The compliance-corpus-v2 family remains in place because the source registry, source-manifest, and
generic ingestion utilities have not yet been redesigned. Retaining those contracts does not make
their former corpus or execution semantics active architecture. Their retirement or
generalization requires a separate decision.

## Historical pilot-local schemas

The `snapshot/eu-us-ai-evaluation-v1` tag preserves `reviewed_dataset.schema.json`,
`normalized_claim.schema.json`, and `headline_judgments.schema.json` beneath the snapshot's
`original/schemas/` path. They are historical pilot-local contracts and are absent from the active
schema tree.

## Layer ownership

| Concept            | Owning layer                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| source             | core; source registry and evidence document versions                                                        |
| passage            | core; evidence passage definition                                                                           |
| entity             | core responsibility; no standalone universal entity contract is introduced here                             |
| claim              | core; evidence claim definition                                                                             |
| relationship       | core envelope, with family-specific relationship fields in extensions                                       |
| review             | core; evidence review definition                                                                            |
| corpus manifest    | core responsibility; legacy source manifests remain compatibility-only until migration                      |
| published judgment | the relevant family extension plus core provenance; legacy score-shaped judgments remain compatibility-only |
| decision case      | analysis; separate from corpora and records, under proposed ADR 0026                                        |
| decision execution | analysis; an untrusted candidate and recorded check that must be freshly checked at use                     |

## Protocols and migration records

- Language grammar protocol: `protocols/language/writ.ebnf`
- Architecture decision: `adr/0013-schema-and-protocol-authority.md`
- Completed path map: `docs/migrations/repository-reset/04-schema-protocol-path-map.md`
- Completed reference implementation retirement:
  `docs/migrations/repository-reset/08-reference-core-retirement.md`
