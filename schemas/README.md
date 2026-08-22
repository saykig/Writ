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

## Protocols and migration records

- Language grammar protocol: `protocols/language/writ.ebnf`
- API protocol: `protocols/api/openapi.yaml`
- Architecture decision: `adr/0013-schema-and-protocol-authority.md`
- Completed path map: `docs/migrations/repository-reset/04-schema-protocol-path-map.md`
- Completed reference implementation retirement:
  `docs/migrations/repository-reset/08-reference-core-retirement.md`
