# Repository reset handoff

**Historical Prompt 7 snapshot.** Prompt 8 resolved the remaining hygiene items. See
[`08-reference-core-retirement.md`](./08-reference-core-retirement.md) and the current
[`repository-structure.md`](../../current/repository-structure.md).

This is the Prompt 7 handoff for the reset completed through the query/interface layer. Historical
artifacts remain inspectable; active corpora, schemas, protocols, queries, and runtime code have
separate authorities.

## 1. Final directory tree

```text
Writ/
├── apps/{api,ingest,web}/
├── corpora/
│   ├── jurisdictions/{eu,us}/ai-governance/
│   └── multilateral/{g7/2025-ai-sme,g20/2024-rio}/
├── queries/eu-us-ai-governance-pilot/
├── schemas/{core,extensions,analysis,compatibility}/
├── protocols/{api,language}/
├── benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/
├── packages/
├── conformance/
├── tests/
├── archive/{pilots,plans}/
├── docs/{current,migrations}/
├── adr/
├── data/                  # generated compatibility output only
└── reference-core/        # retained compatibility test oracle
```

## 2. Old-to-new path mappings

The complete schema/protocol map is in
[`04-schema-protocol-path-map.md`](./04-schema-protocol-path-map.md),
and the complete EU/US identifier maps are the two active `migration-map.yaml` files documented in
[`05-eu-us-corpus-migration.md`](./05-eu-us-corpus-migration.md). The reset's directory-level map is:

| Old path | Current path or disposition |
| --- | --- |
| `specs/*.schema.json` and mixed root `schemas/*.schema.json` | `schemas/{core,analysis,compatibility}/`; see complete map |
| `specs/writ.ebnf` | `protocols/language/writ.ebnf` |
| `specs/openapi.yaml` | `protocols/api/openapi.yaml` |
| `pilot/eu-us-ai-evaluation/` | immutable `archive/pilots/eu-us-ai-evaluation-v1/original/` plus independent active EU and US corpora |
| combined pilot question/headline | `queries/eu-us-ai-governance-pilot/query.yaml` and immutable archive methodology |
| `EU-##` / `US-##` active identity | deterministic UUIDv5 `machine_id`; old values retained in `legacy_refs` and migration maps |
| `benchmark/2025-ai-sme/sources*` | G7 corpus `sources/` |
| `benchmark/2025-ai-sme/evidence/*` | G7 evaluator benchmark evidence compatibility snapshots |
| remaining `benchmark/2025-ai-sme/*` | `benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/` |
| `benchmark/2024-rio-g20/normalized/*` | G20 `records/`, `reviews/`, and `provenance/` |
| `benchmark/2024-rio-g20/sources*` | G20 `sources/` |
| `data/manifests/g20/2024-rio/*` | G20 `provenance/` |
| `data/raw/g20/`, `data/normalized/g20/`, `data/benchmarks/` | removed empty or stale placeholders |
| `apps/web/app/playground/` | `apps/web/app/lab/` with permanent `/playground` → `/lab` redirect |
| `apps/web/components/playground/` | `apps/web/components/lab/` |
| `apps/web/{lib,scripts,test}/policy-test-*` | neutral `demo-analysis-*` names |
| obsolete compliance-first plans | `archive/plans/compliance-product-v1/` |
| external named weighted-ordinal product artifacts | removed; generic behavior uses Writ-owned synthetic fixtures |

## 3. Schema authority

`schemas/README.md` is authoritative. `schemas/core/` owns universal records;
`schemas/extensions/` owns family-specific institutional, legal, policy, theoretical, and empirical
fields; `schemas/analysis/` owns outputs and traces; `schemas/compatibility/` owns versioned legacy
contracts. Protocols live only under `protocols/`. Generated copies in packages are runtime
artifacts, not competing authorities. The core does not require commitments, obligations, or scores.

## 4. Preservation counts

| Corpus/material | Before | After |
| --- | ---: | ---: |
| EU reviewed parents | 12 combined-pilot parents | 12 imported reviews |
| EU atomic claims | 15 | 15 |
| EU sources / anchored passages / unresolved sources | 3 / 10 / 2 | 3 / 10 / 2 |
| EU relationships / legacy mappings | 41 / 17 | 41 / 17 |
| US reviewed parents | 12 combined-pilot parents | 12 imported reviews |
| US atomic claims | 17 | 17 |
| US sources / anchored passages / unresolved sources | 10 / 12 / 1 | 10 / 12 / 1 |
| US relationships / legacy mappings | 50 / 21 | 50 / 21 |
| G7 actions | 87 | 87 (CA 20, EU 11, FR 7, DE 11, IT 11, JP 7, UK 14, US 6) |
| G7 actors / statement / statement-action links | 8 / 1 / 87 | 8 / 1 / 87 |
| G7 published judgments / action reviews | 8 / 87 | 8 / 87 |
| G7 methodology assignments | 63 strong, 24 weak, 0 countervailing | same, benchmark-only |
| G20 statements / selections | 13 / 13 | 13 / 13 |
| G20 reports / published member judgments | 2 / 546 | 2 / 546 |
| G20 reconciliation / review queue | 1 incomplete / 15 | 1 incomplete / 15 |
| G20 expected / missing coverage | 174 / 161 | 174 / 161; no records invented |

Across EU and US, all 24 parent reviews, 32 atomic claims, 10 verified sources, 22 anchored passages,
3 unresolved sources, 12 explicit `unknown` enforcement values, and 38 legacy references remain.

## 5. Identifier migration rules

EU/US active records use deterministic UUIDv5 identities under namespace
`6f806bca-a20b-5e2f-a445-6a15e6958ef4`, derived from stable corpus coordinates rather than mutable
content or spreadsheet order. Readable refs use
`jurisdiction/field/instrument/official-locator#short-claim-label`; relationships use `machine_id`.
Every old row or child ID resolves exactly once through a migration map or archived exclusion.
Article 55(1)(a–d) remains legacy `EU-06` through `EU-09`; temporary Article 51/52 rows remain
excluded. G7 and G20 have complete migration maps from their former benchmark identifiers.

## 6. Archived materials

- `archive/pilots/eu-us-ai-evaluation-v1/` preserves the byte-identical combined pilot, reviewed
  YAML, research report, schemas, methodology, normalized outputs, provenance, checksums, and test
  references. It is historical context, not either active corpus.
- `archive/plans/compliance-product-v1/` preserves the superseded compliance-first plan and explains
  what remains reusable.

## 7. Removed materials

The external named weighted-ordinal product, its corpus/generator/copy, and all references were
removed while generic weighted-ordinal analyzer behavior was retained with synthetic fixtures.
Mixed `specs/`, empty G20 raw/normalized placeholders, stale `data/benchmarks/`, the active combined
EU–US pilot, and Playground/policy-test path names were removed or replaced as mapped above.

## 8. Remaining compatibility code

- `reference-core/` is a non-production parity oracle consumed by conformance and pack validation;
  bounded retirement is `RETIRE-REFERENCE-CORE`.
- `schemas/compatibility/` and `packages/domain/schemas/` preserve versioned interchange/runtime
  compatibility without defining the universal model.
- `data/source-registry.json` and web embedded data are deterministic generated projections.
- G7 evidence snapshots and the historical EU–US Demo shape remain compatibility views whose
  generators validate them against active corpus records.

## 9. Unresolved questions

Prompt 8 must verify consumers before deciding whether the singular `benchmark/` FATF template,
older root `examples/` and `fixtures/`, duplicate narrative docs, or tracked generated projections
should be retired. It must also complete the `reference-core` retirement gate rather than deleting
the oracle speculatively. No new corpus or ontology work belongs in that pass.

## 10. Test and build results

Verified on 2026-07-31:

- `bun run format`, `bun run lint`, and `bun run typecheck`: pass for every workspace.
- `bun run test`: pass for every workspace; the existing data-dependent FATF reproduction remains
  one explicit `todo`, not a failure.
- `ruff check apps/ingest tests` and `pytest -q apps/ingest tests`: pass, 81 Python tests.
- `bun run conformance`: pass, 143 tests; `scripts/validate_pack.py`: pass.
- source-registry, EU/US migration, G20 emission, and G7/G20 adapter checks: deterministic and clean.
- `bun run replicate`: 20/20 benchmark re-derivation checks pass.
- `bun run build`: pass for every workspace; Next production output contains `/`, `/demo`,
  `/how-it-works`, `/lab`, and the API routes.
- the repository's responsive/layout frontend assertions pass in the web test suite; no separate
  browser-driven responsive suite is present.
- all ten Prompt 7 tracked-tree gates pass, including the zero-match removed-product scan.

## 11. Preservation confirmation

No reviewed evidence, source locator, identifier, unknown/contested value, legal distinction, or
provenance record was silently changed. Migrations retain complete maps and archive checksums;
derived views are regenerated deterministically and validated against active corpus counts.
