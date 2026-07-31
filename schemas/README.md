# Schema authority

`schemas/` is the only active JSON Schema authority for Writ. All authoritative schemas use JSON
Schema 2020-12. Files under `packages/domain/schemas/` are generated, drift-guarded vendor copies
for runtime packaging; they are not a second authority.

The frozen EU-US pilot keeps three local schemas under
`pilot/eu-us-ai-evaluation/schemas/` until its corpus migration. Those contracts are
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

| Schema                               | Classification | Responsibility                                                                                                          |
| ------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `core/evidence.schema.json`          | core           | Frozen source versions, passages, claims, relationships embedded in evidence actions, reviews, and snapshot provenance. |
| `core/source-registry.schema.json`   | core           | Generated source-registry interchange document.                                                                         |
| `core/corpus_vocabulary.schema.json` | core           | Reviewed controlled-vocabulary mappings shared by corpus adapters.                                                      |

No core schema requires a commitment, obligation, compliance result, or score.

## Family extensions

`extensions/` is the authority location for institutional, legal, policy, theoretical, and
empirical contracts. No family-specific schema is introduced by this path-cleanup branch. The
classification and dependency rules are recorded in
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

## Compatibility-only schemas

| Schema family                                                     | Classification     | Status                                                                                                                                                   |
| ----------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compatibility/compliance-corpus-v2/*.schema.json`                | compatibility-only | Version 2 G7/G20 summit-compliance records. These contracts remain active only for existing adapters and records; they are not the universal Writ model. |
| `compatibility/g7-benchmark-v1/methodology-inventory.schema.json` | compatibility-only | Historical G7 benchmark extraction worksheet.                                                                                                            |

The compliance-corpus-v2 family contains `assessment`, `commitment`, `compliance_report`,
`evidence`, `methodology`, `reconciliation_manifest`, `review_item`, `source_document`,
`source_manifest`, and `source_registry_config`. The registry configuration remains operational
for existing adapters, but its required commitment/score preservation controls make it
compatibility-only rather than universal core. Its version and semantics are unchanged by
relocation.

## Pilot-local schemas

| Schema                                                             | Classification       |
| ------------------------------------------------------------------ | -------------------- |
| `pilot/eu-us-ai-evaluation/schemas/reviewed_dataset.schema.json`   | archived pilot-local |
| `pilot/eu-us-ai-evaluation/schemas/normalized_claim.schema.json`   | archived pilot-local |
| `pilot/eu-us-ai-evaluation/schemas/headline_judgments.schema.json` | archived pilot-local |

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
- Complete path map: `docs/current/schema-protocol-path-map.md`
- `reference-core` migration proposal: `docs/current/reference-core-retirement.md`
