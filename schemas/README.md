# Schema authority

`schemas/` is the only active JSON Schema authority for Writ. All authoritative schemas use JSON
Schema 2020-12. Files under `packages/domain/schemas/` are generated, drift-guarded vendor copies
for runtime packaging; they are not a second authority.

The frozen EU-US pilot keeps three local schemas under
`archive/pilots/eu-us-ai-evaluation-v1/original/schemas/`. Those contracts are
`archived pilot-local`: they govern only that preserved pilot and are not active global Writ
schemas.

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
- Analysis/output contracts may depend on core and named extensions.
- Compatibility families are isolated versioned contracts. Current code may consume them during
  migration, but new core or extension schemas must not depend on them.
- Pilot-local contracts remain self-contained.

Family-specific fields are never required globally. A legal record may require legal force, an
empirical record may require study design, and an analysis result may require a methodology and
trace; those requirements belong to their family or layer, not the shared core.

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

## Analysis and output schemas

| Schema                                        | Classification  | Responsibility                                                                                                              |
| --------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `analysis/canonical-ir.schema.json`           | analysis/output | Compiled methodology program; commitment and score constructs here are analysis-language constructs, not universal records. |
| `analysis/evaluation-receipt.schema.json`     | analysis/output | Writ-derived result, declared inputs, proof nodes, dependencies, and canonical trace.                                       |
| `analysis/interpretation-profile.schema.json` | analysis/output | Versioned analytical choices and waivers.                                                                                   |
| `analysis/search-protocol.schema.json`        | analysis/output | Reviewed evidence-coverage protocol for negative analytical claims.                                                         |
| `analysis/discrepancy.schema.json`            | analysis/output | Differences between source-reported judgments and derived benchmark results.                                                |
| `analysis/release.schema.json`                | analysis/output | Reproducible publication bundle and dependency hashes.                                                                      |
| `analysis/record-judgment.schema.json`        | analysis        | Independent judgments targeting a record or record link.                                                                    |

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

| Schema family                                                             | Classification     | Status                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compatibility/compliance-corpus-v2/*.schema.json`                        | compatibility-only | Version 2 G7/G20 summit-compliance records. These contracts remain active only for existing adapters and records; they are not the universal Writ model.                                        |
| `compatibility/g7-benchmark-v1/methodology-inventory.schema.json`         | compatibility-only | Historical G7 benchmark extraction worksheet.                                                                                                                                                   |
| `compatibility/record-grammar-v0.1/*.schema.json`                         | compatibility-only | Frozen v0.1 base, legal-policy, institutional-profile, and record-judgment contracts.                                                                                                           |
| `compatibility/eu-us-ai-reviewed-v1/reviewed-corpus-document.schema.json` | compatibility-only | The preserved reviewed EU/US AI-governance corpus format. It describes the imported payload exactly as generated from the frozen pilot input; it is not the native legal-policy record grammar. |

The compliance-corpus-v2 family contains `assessment`, `commitment`, `compliance_report`,
`evidence`, `methodology`, `reconciliation_manifest`, `review_item`, `source_document`,
`source_manifest`, and `source_registry_config`. The registry configuration remains operational
for existing adapters, but its required commitment/score preservation controls make it
compatibility-only rather than universal core. Its version and semantics are unchanged by
relocation.

## Pilot-local schemas

| Schema                                                                                  | Classification       |
| --------------------------------------------------------------------------------------- | -------------------- |
| `archive/pilots/eu-us-ai-evaluation-v1/original/schemas/reviewed_dataset.schema.json`   | archived pilot-local |
| `archive/pilots/eu-us-ai-evaluation-v1/original/schemas/normalized_claim.schema.json`   | archived pilot-local |
| `archive/pilots/eu-us-ai-evaluation-v1/original/schemas/headline_judgments.schema.json` | archived pilot-local |

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
| derived result     | analysis/output; evaluation receipt                                                                         |
| trace              | analysis/output; receipt proof and dependency graph                                                         |

## Protocols and migration records

- Language grammar protocol: `protocols/language/writ.ebnf`
- API protocol: `protocols/api/openapi.yaml`
- Architecture decision: `adr/0013-schema-and-protocol-authority.md`
- Completed path map: `docs/migrations/repository-reset/04-schema-protocol-path-map.md`
- Completed reference implementation retirement:
  `docs/migrations/repository-reset/08-reference-core-retirement.md`
