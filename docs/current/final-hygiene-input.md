# Verified input for Prompt 8 repository hygiene

This inventory classifies the repository after Prompt 7. It does not perform the full hygiene pass.
Deletion requires a proven absence of consumers and an explicit retention decision.

## Top-level path classification

| Path | Classification | Verified role or next check |
| --- | --- | --- |
| `.agents/` | active product code | Local Writ domain skill; current product language. |
| `.github/` | active product code | CI and repository automation. |
| `.claude/` | unresolved and requiring verification | Tracked editor launch configuration; verify supported tooling. |
| `.bun-version`, `.nvmrc`, `.python-version` | active product code | Toolchain pins. |
| `.env.example` | current documentation | Non-secret environment contract. |
| `.gitignore`, `.prettierignore`, `.prettierrc.json` | active product code | Repository tooling configuration. |
| `AGENTS.md`, `README.md`, `START_HERE.md`, `PRODUCT.md`, `DESIGN.md` | current documentation | Governing source-of-truth documents. |
| `VALIDATION.md`, `VERSION_POLICY.md` | current documentation | Validation and release policy. |
| `TASKS.yaml` | current documentation | Reset status and bounded follow-up tasks. |
| `MANIFEST.sha256` | generated but required | Tracked-tree integrity manifest; deterministically regenerated. |
| `Makefile`, `package.json`, `bun.lock`, `eslint.config.js`, `tsconfig.base.json`, `docker-compose.yml` | active product code | Build, test, dependency, and local-service configuration. |
| `apps/` | active product code | API, ingestion, and active Next.js web app. |
| `packages/` | active product code | Domain, compiler, evaluator, analyzer, provenance, benchmark, and conformance packages. |
| `corpora/` | active corpus | Independent jurisdictional and multilateral source authorities. |
| `queries/` | active product code | Saved reproducible inquiry-layer objects. |
| `schemas/` | authoritative schema or protocol | Only active JSON Schema authority. |
| `protocols/` | authoritative schema or protocol | Language grammar and API protocol authority. |
| `config/` | active product code | Hand-edited source registry and vocabulary configuration. |
| `conformance/` | active product code | Implementation-independent semantic cases and runner inputs. |
| `tests/` | active product code | Python corpus, ingestion, schema, and query tests. |
| `db/` | active product code | Append-only artifact-store migrations and database support. |
| `scripts/` | active product code / unresolved | Used validation, ingestion, generation, publication, and demo scripts; verify individually below. |
| `benchmarks/` | active product code | Evaluator behavior and historical reproduction, separate from corpus authority. |
| `benchmark/` | unresolved and requiring verification | Singular FATF template remains; consumers and naming duplication are not proven. |
| `examples/` | unresolved and requiring verification | Compiler/analyzer examples with known test/runtime consumers; per-file retention not proven. |
| `fixtures/` | unresolved and requiring verification | Generic analyzer fixtures; per-file consumers need a machine-readable inventory. |
| `reference-core/` | unresolved and requiring verification | Required compatibility oracle today; bounded retirement task exists. |
| `data/` | generated but required | Generated compatibility projection only; not corpus authority. |
| `docs/` | current documentation / historical | `docs/current/` is current; older narratives and migration records need link/duplication audit. |
| `adr/` | current documentation / historical | Append-only architectural decision history. |
| `archive/` | historical | Explicitly non-normative plans and pilot context with checksums. |

Local untracked/ignored top-level paths are not repository authorities: `.git/` is version-control
state; `node_modules/` and `.venv/` are dependency outputs; `.mypy_cache/`, `.pytest_cache/`,
`.ruff_cache/` are test caches; `.vercel/` is deployment output; `.env` and `.env.local` are local
secret-bearing configuration. They are local output that should remain ignored.

## Duplicated directories and authority overlaps

- `benchmark/` and `benchmarks/` are a naming duplicate. `benchmarks/` is current; the remaining
  FATF template under singular `benchmark/` needs a consumer/retention decision.
- `reference-core/` overlaps canonical package behavior but is still an active parity oracle. Follow
  `docs/current/reference-core-retirement.md` and `RETIRE-REFERENCE-CORE`.
- `packages/domain/schemas/` duplicates schemas by design as generated runtime copies. Verify whether
  package-time generation can replace tracking before removal.
- `data/source-registry.json` duplicates `config/source_registry.yml` by design as a deterministic
  compatibility projection.
- `docs/current/`, root governing docs, older `docs/*.md`, and `docs/migrations/` have different
  intended audiences, but internal-link and repeated-content checks are still needed.

## Obsolete, historical, and generated candidates

- Confirm whether `benchmark/fatf-mutual-evaluation/` and `examples/fatf-mutual-evaluation.writ`
  remain part of active compatibility coverage or should move together.
- Audit `examples/2025-ai-sme-*` and the six root JSON fixtures by an `rg` consumer map before any
  move; several are referenced by tests, web runtime loaders, and replication.
- Audit `docs/ANALYZER-SCOPE.md`, `docs/NEXT-METHODOLOGIES.md`, `docs/PILOT.md`, `docs/PROOF.md`, and
  `docs/REPLICATION.md` for duplication and broken links against current authorities.
- Historical planning documents are intentionally confined to `archive/plans/`; the combined pilot
  is intentionally confined to `archive/pilots/`.
- Tracked generated candidates are `MANIFEST.sha256`, `data/source-registry.json`,
  `packages/domain/schemas/*`, `apps/web/lib/frozen-data.ts`,
  `apps/web/lib/demo-analysis-data.ts`, and `apps/web/lib/repo-provenance.ts`. Keep them until build,
  package, and deployment consumers are mapped.

## Scripts, fixtures, dependencies, and links requiring proof

- `scripts/validate_pack.py` and `packages/conformance/test/canonical-parity.test.ts` prove current
  `reference-core` use. Remove their coupling only with replacement fixtures.
- Verify direct consumers of `scripts/discover_sources.py`, `fetch_sources.py`,
  `parse_assessments.py`, `parse_commitments.py`, and `publish_corpus.ts`; network-facing or database
  workflows may not appear in unit-test searches.
- Produce an import/command map before pruning package dependencies. Lockfile presence alone does
  not prove runtime use.
- Run a Markdown-link checker that understands repository-relative anchors, archive paths, and ADR
  references; plain filesystem checks are insufficient for headings and generated docs.
- None of the four explicitly prohibited legacy product/dashboard term families is present in the
  active tracked tree. Historical compliance terminology remains only where provenance or archived
  product history requires it; Prompt 8 must not erase source titles or compatibility semantics.

## Prompt 8 boundary

Prompt 8 may remove or consolidate only verified obsolete material. It must not add new corpora,
ontology families, answer generation, chat, databases, or scoring systems, and it must not change
reviewed corpus contents while resolving repository hygiene.
