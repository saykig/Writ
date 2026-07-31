# Internal repository-support consolidation

This migration moves active developer-only machinery under `internal/` so the root foregrounds
product interfaces, knowledge authorities, current documentation, packages, protocols, queries,
schemas, and preserved history. Nothing moved here is archived or obsolete merely because it is
internal.

## Pre-move classification

| Root path | Classification and disposition |
| --- | --- |
| `apps/`, `corpora/`, `packages/`, `protocols/`, `queries/`, `schemas/` | active public or knowledge authority; unchanged |
| `docs/` | active documentation plus historical migration records; unchanged except for this record |
| `archive/` | historical, non-authoritative material; retained, with one live benchmark link updated after the move |
| `adr/` | active architecture authority; retained because corpus identity metadata resolves these stable paths |
| `.agents/`, `.github/` | active developer support retained at conventional discovery paths |
| `benchmarks/`, `conformance/`, `fixtures/`, `examples/`, `scripts/`, `tests/` | active verification/tooling material; moved and classified below |
| `config/`, `data/`, `db/` | active infrastructure; moved below |
| `README.md`, `AGENTS.md`, `START_HERE.md`, `PRODUCT.md`, `DESIGN.md` | active root entry points and governing documentation; retained |
| `TASKS.yaml`, `VALIDATION.md`, `VERSION_POLICY.md` | active workflow contracts; retained at their established root paths |
| `.bun-version`, `.nvmrc`, `.python-version`, `.env.example`, `.gitignore`, `.prettierignore`, `.prettierrc.json` | essential root tool/environment conventions; retained |
| `package.json`, `bun.lock`, `tsconfig.base.json`, `eslint.config.js`, `Makefile`, `docker-compose.yml` | essential workspace/build configuration; retained |
| `MANIFEST.sha256` | required generated tracked-tree checksum; retained and regenerated |

No historical material was newly archived. No generated artifact was untracked without a proven
replacement.

## Old-path to new-path map

| Old path | New path |
| --- | --- |
| `benchmarks/` | `internal/verification/benchmarks/` |
| `conformance/` | `internal/verification/conformance/` |
| `fixtures/ai-sme-*.json` | `internal/verification/fixtures/compatibility/g7-ai-sme/` |
| `fixtures/{missing-action-identity,transnational-prose-mismatch,unknown-threshold}.json` | `internal/verification/fixtures/language/diagnostics/` |
| `examples/2025-ai-sme-*` | `internal/verification/fixtures/compatibility/g7-ai-sme/` |
| `examples/2025-benchmark.sample-release.json` | `internal/verification/fixtures/compatibility/g7-ai-sme/` |
| `examples/{2025-critical-minerals,2025-infrastructure,2025-middle-east}.writ` | `internal/verification/fixtures/language/g7-methodologies/` |
| `scripts/` | `internal/tooling/scripts/` |
| `scripts/demo.sh` | `internal/verification/fixtures/compatibility/g7-ai-sme/demo.sh` |
| `config/` | `internal/infrastructure/config/` |
| `data/` | `internal/infrastructure/generated/` |
| `db/` | `internal/infrastructure/database/` |
| `tests/benchmarks/` | `internal/verification/integration/benchmarks/` |
| `tests/corpora/` | `internal/verification/integration/corpora/` |
| `tests/ingestion/` | `internal/verification/integration/ingestion/` |
| `tests/queries/` | `internal/verification/integration/queries/` |
| `tests/schema/` | `internal/verification/schema/` |
| `tests/fixtures/synthetic/` | `internal/verification/fixtures/schemas/synthetic/` |

Application and package tests remain colocated under `apps/*/test`, `apps/*/tests`,
`packages/*/test`, or `packages/*/tests`. Package-owned generators and generated schema/web files
also remain colocated because their package build and release consumers resolve them there.

## Deleted instead of moved

- `examples/README.md` was a public-facing index for retired G7 compliance/scoring examples. The
  active inputs are now documented by bounded internal fixture READMEs; Git preserves the old index.
- `fixtures/README.md` was superseded by the classified `internal/verification/fixtures/` index.
- `scripts/requirements.txt` was an unconsumed two-line dependency duplicate. Python dependencies
  and development tools are owned by `apps/ingest/pyproject.toml`.

No substantive example or fixture was deleted. Files without public-example status remain active
only where tests or compatibility verification consume them.

## AI-for-SMEs handling

All former root AI-for-SMEs examples and analyzer fixtures now live under
`internal/verification/fixtures/compatibility/g7-ai-sme/`. Its README states that the material
tests historical evaluator/scoring behavior, is not a current general corpus model, and is not
Writ's primary demonstration. The old demo script moved with the fixture and identifies itself as a
compatibility check. The historical reproduction remains under internal evaluator benchmarks;
authoritative political records remain in the G7 corpus.

## Generated material

`internal/infrastructure/generated/source-registry.json` remains tracked because API tests,
publication tooling, schema validation, and drift checks consume its deterministic projection.
Package-owned generated schemas and web embeds remain tracked and colocated because builds package
or deploy them. `MANIFEST.sha256` remains the complete tracked-tree checksum.

## Narrow exceptions

The requested moves were otherwise followed exactly. `.agents/` and `.github/` cannot move without
breaking external discovery. `adr/` remains at the root because moving it would require rewriting
stable `identity_adr` values in active EU and US corpus manifests. Root workspace configuration and
governing entry points remain where their tools and contributors expect them.

Historical migration documents retain path references that were accurate when written. The
Prompt 7 handoff and Prompt 8 hygiene input are snapshots; this document supplies the current map.
