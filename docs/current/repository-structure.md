# Repository structure and ownership

This document explains the present tree after the staged repository reset. It is a retention and
authority map, not a new knowledge model.

## Active authorities

| Path | Owns | Does not own |
| --- | --- | --- |
| `corpora/` | reviewed jurisdictional and multilateral records, source passages, provenance, reviews, and corpus manifests | comparison questions or evaluator methodologies |
| `schemas/` | all active JSON Schema contracts | language or HTTP protocol definitions |
| `protocols/` | Writ language EBNF and API OpenAPI contracts | corpus records |
| `queries/` | reproducible questions over versioned corpora | corpus identity or source truth |
| `packages/` | shared runtime, compiler, analyzer, evaluator, provenance, CLI, and test tooling | reviewed political data |
| `apps/` | ingestion and user-facing product interfaces | schema or corpus authority |
| `docs/current/` | current product and technical guidance | historical migration evidence |

`adr/` holds accepted architecture decisions. When an earlier decision describes superseded
implementation wiring, a later ADR records the change rather than rewriting history.

## Supporting and historical areas

- `benchmarks/` owns evaluator fixtures, methodologies, expected derived results, and historical
  reproduction notes. A benchmark may read a corpus but is not a corpus authority.
- `conformance/` owns portable semantic inputs and expected outputs. It contains no implementation.
- `examples/` and `fixtures/` remain because active compiler and analyzer tests consume them.
- `config/` owns reviewed registry inputs; `data/` contains generated compatibility projections or
  runtime output only.
- `db/`, `scripts/`, and `tests/` contain infrastructure, automation, and cross-package checks.
- `archive/` preserves non-normative pilots and plans that remain useful for inspection.
- `docs/migrations/` preserves completed reset path maps and verification handoffs.

## Final-hygiene decisions

- Historical reset reports moved from `docs/current/` to `docs/migrations/repository-reset/`.
- Historical G7 pilot, proof, replication, and architecture notes moved beside their evaluator
  benchmark.
- The source-gated FATF methodology moved from the singular `benchmark/` and root `examples/` paths
  into `benchmarks/evaluator/fatf-mutual-evaluation-scaffold/`.
- The general data-model diagram moved into current technical documentation.
- Superseded methodology planning moved to `archive/plans/methodology-candidates-v1/`.
- The duplicate `reference-core/` implementation was retired only after its remaining behavior was
  proven covered by implementation-independent conformance cases and canonical package tests.
- An editor-specific launch file and a redundant generated source-registry summary were removed;
  neither had a consumer, and the authoritative registry documentation remains in `data/README.md`.

All deleted material remains recoverable from Git history. The cleanup does not rewrite the
Covenant-to-Writ development history.

## Preservation gate

The cleanup does not edit any file under `corpora/` or the frozen EU–US pilot archive. Validation
continues to enforce:

- 12 EU and 12 US reviewed parent annotations;
- 15 EU and 17 US atomic claims and every legacy identifier mapping;
- 87 G7 government-action records;
- 13 ingested G20 Rio political statements, two reports, and 546 published member judgments;
- the 174-item G20 inventory with 161 entries explicitly missing rather than fabricated.

Unknown and contested values, reviewed judgments, source locators, identifiers, passages, and
provenance remain unchanged.
