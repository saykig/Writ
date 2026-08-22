# Repository structure and ownership

This document explains the present tree after the staged repository reset. It is a retention and
authority map, not a new knowledge model.

## Active authorities

| Path | Owns | Does not own |
| --- | --- | --- |
| `corpora/` | reviewed native records, source passages, provenance, reviews, and corpus manifests | questions or execution methodologies |
| `schemas/` | all active JSON Schema contracts | language or HTTP protocol definitions |
| `protocols/` | Writ language EBNF and API OpenAPI contracts | corpus records |
| `packages/` | domain contracts, native compiler, provenance, CLI, data export, and test tooling | reviewed political data |
| `apps/` | API and ingestion applications | schema or corpus authority |
| `docs/current/` | current product and technical guidance | historical migration evidence |

`adr/` holds accepted architecture decisions. When an earlier decision describes superseded
implementation wiring, a later ADR records the change rather than rewriting history.

## Supporting and historical areas

- `internal/verification/` owns native fixtures, the Writ Verification Harness, and root-level
  integration/schema suites.
- `internal/tooling/` contains repository-maintenance, migration, validation, publication, and
  reproduction commands.
- `internal/infrastructure/` contains operational registry inputs, deterministic generated
  compatibility projections, and database migrations.
- `archive/` contains non-normative historical material. Active code and verification do not
  require it; reviewed catalogued corpora remain under `corpora/`, not `archive/`.
- `docs/migrations/` preserves completed reset path maps and verification handoffs.

Application- and package-owned tests and generators remain colocated under `apps/*` and
`packages/*`. `.github/` and `.agents/` remain at the root because their external consumers require
those conventional discovery paths. `adr/` remains because corpus identity metadata resolves to
stable accepted-decision paths.

## Final-hygiene decisions

- Historical reset reports moved from `docs/current/` to `docs/migrations/repository-reset/`.
- The general data-model diagram moved into current technical documentation.
- Obsolete compliance and methodology planning was removed from the tracked tree and remains
  recoverable from Git history and the `pre-foundation-reset-2026-08-22` tag.
- The obsolete evaluator, analyzer, benchmark, and compliance conformance packages were retired
  after native record lowering was proven independent.
- An editor-specific launch file and a redundant generated source-registry summary were removed;
  neither had a consumer.
- Developer-only root machinery was consolidated under `internal/`; the complete path map is in
  `docs/migrations/internal-repository-support.md`.

All deleted material remains recoverable from Git history. The cleanup does not rewrite the
Covenant-to-Writ development history. Corpora and records exist independently of questions,
comparisons, analyses, and presentation layers.

## Preservation gate

Structural cleanup does not change NIST, European Commission, or legal-policy corpus bytes or
substantive semantics. NIST is the sole active development proving ground, while the other reviewed
catalogued corpora remain secondary material. Validation continues to enforce declared contracts,
catalog-to-manifest routes, evidence resolution, source checksums, migration history, deterministic
bundle output, and the repository checksum inventory. Historical archive material is not an active
verification input.
