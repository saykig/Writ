# Repository reset audit

## Scope and starting state

This is the evidence-only audit for `reset/01-audit-and-freeze`. It records the repository state
needed by later reset pull requests; it does not redefine runtime behavior or move data.

- Remote: `https://github.com/saykig/Writ.git`
- Base branch: `main`
- Starting `origin/main`: `a435e9d2a340df58fcbb6dad85ea8444e7b72e52`
- Starting local `HEAD`: `a435e9d2a340df58fcbb6dad85ea8444e7b72e52`
- Starting status after the requested restoration of `apps/web/components/site/nav-items.ts`: clean
- Audit branch: `reset/01-audit-and-freeze`
- The pre-audit restoration exactly matched `HEAD`; it created no tracked change and is not part of
  this branch.

The starting SHA differs from the earlier runbook snapshot
`6fd6f4ff59da6672b1a5e1f54956cd8cf3820faa`. The branch was created only after fetching and
fast-forwarding `main` to the actual current `origin/main`.

## Current tracked top-level tree

Generated caches, virtual environments, package installations, and `.git` internals are omitted.

```text
.
├── .agents/
│   └── skills/
├── .claude/
├── .github/
│   └── workflows/
├── adr/
├── apps/
│   ├── api/
│   ├── ingest/
│   └── web/
├── benchmark/
│   ├── 2024-rio-g20/
│   ├── 2025-ai-sme/
│   ├── ai-governance-gap-matrix/
│   └── fatf-mutual-evaluation/
├── codex-tasks/
├── config/
├── conformance/
│   └── cases/
├── data/
│   ├── benchmarks/
│   ├── manifests/
│   ├── normalized/
│   └── raw/
├── db/
│   └── migrations/
├── docs/
│   ├── current/
│   └── plan/
├── examples/
├── fixtures/
├── packages/
│   ├── analyzer/
│   ├── benchmark/
│   ├── cli/
│   ├── conformance/
│   ├── domain/
│   ├── evaluator/
│   ├── language/
│   └── provenance/
├── pilot/
│   └── eu-us-ai-evaluation/
├── reference-core/
│   ├── src/
│   └── test/
├── schemas/
├── scripts/
├── specs/
└── tests/
    ├── benchmarks/
    ├── fixtures/
    ├── ingestion/
    ├── pilot/
    └── schema/
```

There is no tracked `apps/studio/`. The root README and one web source comment still name it.

## Authoritative datasets and generated copies

“Authoritative” means the checked-in reviewed or source-grounded input. “Generated” means a
reproducible projection, normalized graph, build embed, or computed comparison. A generated
artifact can still be frozen and reviewable; it is not the place where later corrections begin.

| Knowledge material | Authoritative or source-grounded input | Generated or derived copies | Current consumers and checks |
| --- | --- | --- | --- |
| EU–US AI-governance review | `pilot/eu-us-ai-evaluation/annotations/human-reviewed.yaml` is explicitly the authoritative hand-reviewed table. `sources/sources.yml` governs acquisition. | `normalized/{records,claims,headline-judgments}.json` from `scripts/emit_eu_us_ai_evaluation.py`; `provenance/*.json` from `scripts/fetch_pilot_sources.py`; `evidence/{eu,us}.snapshot.json` and `coverage.json` from `scripts/build-pilot-snapshot.ts`; web projections `apps/web/lib/policy-test-data.ts` and `apps/web/lib/frozen-data.ts`. | Python pilot builder/tests; web demo, memo, globe, Playground toolchain, and web tests. |
| G20 Rio 2024 | Frozen report excerpts in `benchmark/2024-rio-g20/sources/*.pdf`, their `sources.json`, canonical source policy in `config/source_registry.yml`, and reviewed vocabulary in `config/corpus_vocabulary.yml`. | Six files in `benchmark/2024-rio-g20/normalized/`, emitted by `scripts/emit_g20_rio.py`; `data/manifests/g20/2024-rio/*` records acquisition/reconciliation metadata. | `G20RioAdapter`, corpus validators, schema tests, ingestion tests, publishing scripts, and stale web tracing configuration. |
| G7 2025 AI-for-SMEs | Frozen report PDF, reviewed action catalog in `packages/benchmark/src/members.ts`, methodology/rubric inputs, reviewed tally, and published labels. The action catalog says every action is grounded in the frozen chapter. | `sources.json`, `methodology-inventory.json`, eight evidence snapshots, and two profiles from `packages/benchmark/src/generate.ts`; `discrepancy-ledger.json` from the benchmark runner. | `packages/benchmark`, G7 adapter, conformance tests, examples, and stale web tracing configuration. |
| Source registry | `config/source_registry.yml` plus `schemas/source_registry_config.schema.json`. | `data/source-registry.json`, checked by `scripts/generate_source_registry.py --check`; `data/source-registry-summary.md` is descriptive output. | Ingest registry policy, API seeding/publishing, G7/G20 adapters, tests. |
| Core contract examples | `specs/*.schema.json`, `specs/writ.ebnf`, `specs/openapi.yaml`. | Byte-identical schema vendor copies in `packages/domain/schemas/`; generated TS in `packages/domain/src/generated/`; generated embed `packages/domain/src/schemas.embedded.ts`; example JSON under `examples/`. | Domain validation/generation, compiler/evaluator packages, conformance, API, CLI, tests. |
| Gap Matrix | External Cepheus-derived files under `benchmark/ai-governance-gap-matrix/`, `examples/ai-governance-gap-matrix.writ`, and `scripts/gen-gap-matrix.py`. | The Writ encoding and reproduction test are derived from that external source. | Analyzer/language fixtures, benchmark reproduction test, docs, and web explanatory text. All must be deleted or replaced with synthetic Writ-owned fixtures under the reset decision. |
| FATF example | `benchmark/fatf-mutual-evaluation/README.md` and illustrative template. | Writ teaching encoding in `examples/fatf-mutual-evaluation.writ`. No authoritative country result corpus exists. | Benchmark test; the authoritative reproduction test remains `todo`. Classify as example/fixture, not corpus. |

### EU–US preservation checks

| Check | Expected | Observed |
| --- | ---: | ---: |
| EU reviewed parent annotations | 12 | 12 |
| US reviewed parent annotations | 12 | 12 |
| EU atomic normalized claims | 15 | 15 |
| US atomic normalized claims | 17 | 17 |
| Total reviewed parents | 24 | 24 |
| Total atomic normalized claims | 32 | 32 |

The normalized set contains 18 leaf-parent claims and 14 legally distinct bundle-child claims.
No child claims were merged.

`pilot/eu-us-ai-evaluation/annotations/human-reviewed.yaml` SHA-256:

```text
8de1e3b84a15875a39f3de2857f68dcd3040830ad72ffd9728c1ded0eda07cbb
```

This exactly matches the required hash.

### G20 preservation checks

| Check | Expected | Observed |
| --- | ---: | ---: |
| Ingested political statements/identified commitments | 13 | 13 |
| Assessment selections | 13 | 13 |
| Reports | 2 | 2 |
| Published member judgments | 546 | 546 |
| Reconciliation records | 1 | 1 |
| Review-queue records | 15 | 15 |
| Reported commitment inventory | 174 | 174 |
| Commitments not ingested | 161 | 161 |

The 546 judgments are 273 interim plus 273 final, all stored as source-reported published scores.
The reconciliation record is intentionally `incomplete`: it records 174 expected, 13 extracted,
and warnings `full_inventory_not_enumerated_from_report_source` and
`inventory_source_document_not_ingested`. The 161 missing records must not be invented.

### G7 preservation checks

The eight snapshots contain 87 reviewed actions:

| Member | Actions |
| --- | ---: |
| Canada | 20 |
| European Union | 11 |
| France | 7 |
| Germany | 11 |
| Italy | 11 |
| Japan | 7 |
| United Kingdom | 14 |
| United States | 6 |
| **Total** | **87** |

## Schema dependency map

All JSON Schemas declare draft 2020-12. No schema currently has an external cross-file `$ref`; all
present `$ref` values are local `#/$defs/...` references. This makes physical relocation possible,
but `$id`, loaders, vendor copies, generators, manifests, tests, and documentation still require
coordinated updates.

### Core/planning contracts: `specs/`

| Contract | `$id` suffix | Main dependencies |
| --- | --- | --- |
| `canonical-ir.schema.json` | `/schemas/canonical-ir.schema.json` | Vendored byte-identically to `packages/domain/schemas`; generated TS; compiler, analyzer, evaluator, CLI, conformance, examples. |
| `evidence.schema.json` | `/schemas/evidence.schema.json` | Vendored domain schema; evaluator snapshots; G7 fixtures; pilot evidence snapshots; API snapshot service. |
| `evaluation-receipt.schema.json` | `/schemas/evaluation-receipt.schema.json` | Domain generation, evaluator receipts, examples, API/web verification. |
| `interpretation-profile.schema.json` | `/schemas/interpretation-profile.schema.json` | G7 and pilot profiles, evaluator, benchmark. |
| `methodology-inventory.schema.json` | `/schemas/methodology-inventory.schema.json` | G7 inventory, examples, benchmark generation. |
| `source-registry.schema.json` | `/schemas/source-registry.schema.json` | Legacy generated `data/source-registry.json`, pack validation. It is distinct from the operational YAML registry schema. |
| `discrepancy.schema.json` | `/schemas/discrepancy.schema.json` | Benchmark examples/ledger contracts. |
| `search-protocol.schema.json` | `/schemas/search-protocol.schema.json` | Negative-claim example and domain generation. |
| `release.schema.json` | `/schemas/release.schema.json` | Release example and domain generation. |
| `openapi.yaml` | n/a | Planning API contract; the target location is `protocols/api/openapi.yaml`. |
| `writ.ebnf` | n/a | Language protocol; the target location is `protocols/language/writ.ebnf`. |

Every `specs/*.schema.json` file is currently byte-identical to its same-named
`packages/domain/schemas/` copy. `packages/domain/test/schema-drift.test.ts` enforces this.
`packages/domain/scripts/generate-types.ts` and `embed-schemas.ts` generate the TS interfaces and
runtime embed.

### Summit-compliance contracts: `schemas/`

| Schema group | Files | Direct loader/consumer |
| --- | --- | --- |
| Source and registry | `source_registry_config`, `source_manifest`, `source_document` | `writ_ingest.corpus.registry`, source discovery/fetch/publish scripts, schema tests. |
| Commitment and methodology | `commitment`, `methodology`, `corpus_vocabulary` | `writ_ingest.corpus.validation`, G7/G20 adapters, vocabulary resolver, tests. |
| Reports and judgments | `assessment`, `compliance_report` | Corpus validation, normalized G20 graph, tests. |
| Evidence/reconciliation/review | `evidence`, `reconciliation_manifest`, `review_item` | Corpus validation, adapters, publishing, tests. |

These schemas encode a G7/G20 compliance-corpus compatibility family and should not become the
universal political-knowledge schema. Later work should move them under a clearly labelled
compatibility or analysis location without silently changing version `2.0.0`.

### EU–US pilot-local contracts

| File | Governs | Consumer |
| --- | --- | --- |
| `reviewed_dataset.schema.json` | Authoritative reviewed YAML shape, including parent rows and distinct child claims. | Python pilot builder and tests. |
| `normalized_claim.schema.json` | Each generated atomic claim. | Python generator/tests. |
| `headline_judgments.schema.json` | Generated pilot comparison result. | Python generator/tests. |

The pilot contracts are self-contained and use only local `$defs`. They are not extensions of the
summit-compliance schemas.

## Planned-move dependency map

Inspect and update these callers before any later relocation:

| Planned material | Path-dependent code and configuration |
| --- | --- |
| EU–US pilot to archive plus independent EU/US corpora | `apps/ingest/src/writ_ingest/pilot/eu_us_ai_evaluation.py`; `scripts/{emit_eu_us_ai_evaluation.py,fetch_pilot_sources.py,build-pilot-snapshot.ts}`; `apps/web/scripts/{embed-frozen.ts,embed-policy-test.ts,embed-provenance.ts}`; `apps/web/lib/{toolchain,pilot-assessments,pilot-sources,policy-test,policy-test-data}.ts`; demo/globe components; web and Python pilot tests; `.prettierignore`; pilot README. |
| G20 into `corpora/multilateral/g20/2024-rio` | `G20RioAdapter.SOURCES_FIXTURE`; `scripts/emit_g20_rio.py`; `scripts/validate_corpus.py`; `scripts/publish_corpus.ts`; ingestion/schema tests; `apps/web/next.config.ts`; data manifest references; source registry/vocabulary IDs. |
| G7 into `corpora/multilateral/g7/2025-ai-sme` and score reproduction under `benchmarks/evaluator/` | `packages/benchmark/src/{paths,methodology,generate,run,members,evidence}.ts`; benchmark tests; G7 adapter; `scripts/{replicate.ts,demo.sh,validate_corpus.py}`; `apps/web/next.config.ts`; examples and discrepancy ledger references. |
| `specs/` into `schemas/core` and `protocols/` | `packages/domain/schemas`; schema drift and generated-types tests; `packages/domain/scripts`; `scripts/validate_pack.py`; examples; root docs; API/language references; `$id` values; `MANIFEST.sha256`. |
| Root `schemas/` into compatibility/analysis locations | `apps/ingest/src/writ_ingest/corpus/{validation,registry}.py`; schema tests; scripts; docs; schema `$id` values. |
| `examples/` and `fixtures/` cleanup | language/CLI/analyzer/domain/benchmark tests; `scripts/demo.sh`; `scripts/validate_pack.py`; web tracing comments/config; conformance parity tests. |
| `reference-core/` retirement | root workspaces/scripts; `VALIDATION.md`; `scripts/validate_pack.py`; `packages/conformance/test/canonical-parity.test.ts` direct dynamic import; analyzer/evaluator comments and parity fixtures; ADR 0012. |
| Docs/ADRs to target locations | Root links, `AGENTS.md` required-reading paths, `TASKS.yaml`, `START_HERE.md`, `README.md`, `codex-tasks/*`, CI/document validation. |

Also update or regenerate `MANIFEST.sha256`; it currently names deleted web routes and the Gap
Matrix files and therefore is not a reliable current-tree manifest.

## Major-directory classification

| Path | Classification | Reset decision/evidence |
| --- | --- | --- |
| `apps/api` | current | Active Fastify application. |
| `apps/ingest` | current | Active acquisition/normalization code, including G7/G20 and pilot adapters. |
| `apps/web` | current, with generated and stale compatibility areas | Active Next app. `lib/frozen-data.ts`, `policy-test-data.ts`, and `repo-provenance.ts` are generated. `policy-test-*`, Playground naming, deleted-route traces, and compliance-first copy need later semantic cleanup. |
| `packages/{domain,evaluator,analyzer,language,provenance,cli,conformance}` | current | Production semantic/compiler stack. |
| `packages/benchmark` | current analysis capability with path-bound corpus code | Preserve evaluator reproduction capability; separate source corpus from benchmark outputs. |
| `specs` | current contracts awaiting mechanical relocation | Core schemas plus API/grammar protocol are authoritative today. |
| `schemas` | compatibility contracts | G7/G20 compliance-corpus version 2.0 family; not universal core. |
| `pilot/eu-us-ai-evaluation` | archive candidate plus migration source | Preserve the combined pilot exactly in the archive; derive independent active EU and US corpora without its comparison question or conclusion. |
| `benchmark/2024-rio-g20` | current source corpus in the wrong category/path | Reclassify as multilateral political corpus. |
| `benchmark/2025-ai-sme` | mixed source corpus and generated benchmark | Split authoritative G7 knowledge from score-reproduction benchmark. |
| `benchmark/ai-governance-gap-matrix` | deletion candidate | External Cepheus/Gap Matrix material; do not archive inside Writ. |
| `benchmark/fatf-mutual-evaluation` | example/fixture candidate | No authoritative country result corpus; reproduction test is `todo`. |
| `data` | mixed generated/compatibility/current metadata | Source registry JSON is generated; G20 manifest is operational metadata; empty/README-only raw/normalized areas should not be recreated until they hold real material. |
| `examples` | mixed teaching examples and deletion candidate | Keep small Writ-owned examples. Delete Gap Matrix example; move corpus-like material out. |
| `fixtures` and `tests/fixtures` | current synthetic/broken test inputs | Keep; replace Gap Matrix-dependent cases with synthetic Writ-owned weighted-ordinal fixtures. |
| `conformance` | current | Implementation-independent cases. |
| `reference-core` | compatibility, retirement candidate after parity gate | Duplicated by production packages but still directly imported by conformance. |
| `docs/plan` | archive candidate | Compliance-product-v1 planning history conflicts with governing reset definition. |
| `codex-tasks` | archive candidate or deletion after task migration | Old compliance/Studio delivery prompts. |
| `adr` | current historical decisions, requiring later location/wording review | Accepted technical decisions remain relevant; target is `docs/decisions`. |
| `db` | current | PostgreSQL migrations; no graph database. |
| `config` | current | Canonical source registry and controlled vocabulary. |
| `.agents/skills/writ-domain` | stale product-language candidate | Defines Writ as a G7 compliance DSL. |

## `reference-core/` duplication decision

Decision: `reference-core/` is functionally duplicated and superseded for production use, but it
cannot be deleted in this audit or moved without updating an explicit compatibility gate.

Evidence:

1. `reference-core` exports only a compact truth kernel, fact evaluator, score evaluator, and
   bounded enumerating analyzer.
2. Production `packages/evaluator` implements the same truth operations, expression evaluation,
   intervals, score selection, proof nodes, receipts, temporal values, quantities, classifications,
   and queries.
3. Production `packages/analyzer` says its enumeration and truth semantics are ports or peer
   implementations of `reference-core`, and adds Z3, linting, measures, waivers, stable diagnostics,
   and richer witnesses.
4. `codex-tasks/02-evaluator.md` explicitly says to port and expand `reference-core` into
   `packages/evaluator`.
5. No application imports the `@writ/reference-core` package as runtime authority.
6. `packages/conformance/test/canonical-parity.test.ts` directly imports
   `reference-core/src/index.ts` and compares both stacks. Root workspaces, the
   `conformance:reference` script, pack validation, docs, and ADR 0012 still require it.
7. Baseline parity passes: 143 canonical conformance tests pass, and the reference core checks 98
   bounded assignments.

Retirement gate: preserve parity cases in implementation-independent conformance fixtures, remove
the direct import and root workspace dependency, update validation/docs/ADR references, then delete
`reference-core` in its own reviewable change.

## Cepheus and Gap Matrix inventory

The following tracked references must be removed. Generic weighted-ordinal analyzer capability may
remain after renaming examples and replacing fixtures with synthetic Writ-owned material.

### Runtime, tests, and generators

- `scripts/gen-gap-matrix.py:2-15,56-64` reads `~/personal/cepheus/public/data/gap-matrix`.
- `packages/benchmark/test/gap-matrix-reproduction.test.ts:2-101` reproduces the external method.
- `examples/ai-governance-gap-matrix.writ:2-10` identifies the package and Cepheus source.
- `benchmark/ai-governance-gap-matrix/README.md:1-54` and `assessments.json:7`.
- `packages/analyzer/src/measure-analysis.ts:19,99`.
- `packages/analyzer/test/measure-analysis.test.ts:85`.
- `packages/language/test/measure-compile.test.ts:5,40`.

The last four analyzer/language references can become synthetic weighted-ordinal terminology rather
than deleting the generic feature.

### Web

- `apps/web/components/how-it-works/faq.tsx:33`.
- `apps/web/components/site/section.tsx:29`.
- `apps/web/components/how-it-works/essay-index.tsx:10`.
- `apps/web/test/frontend-architecture.test.ts:46,63` names the retired route/content.

The upstream main branch already deleted the former Gap Matrix route and runtime data module, but
`MANIFEST.sha256:81,148` still lists those deleted paths.

### Documentation and manifests

- `docs/NEXT-METHODOLOGIES.md:3,54`.
- `docs/PILOT.md:71-147`.
- `docs/REVIEWER-BRIEF.md:1-17`.
- `docs/ANALYZER-SCOPE.md:52,73`.
- `PRODUCT.md:29,41`.
- `benchmark/fatf-mutual-evaluation/README.md:11`.
- `MANIFEST.sha256:175-176,266,313,450`.

No Cepheus or Gap Matrix material should be placed in `archive/`.

## Stale product language and surface names

### Compliance-first identity statements

These define Writ itself too narrowly and conflict with the governing reset definition:

- `AGENTS.md:5` — “compliance-evaluation compiler and evidence system.”
- `START_HERE.md:3` — “auditable G7 commitment compliance evaluation.”
- `.agents/skills/writ-domain/SKILL.md:3` — “Writ G7 compliance DSL.”
- `docs/plan/PACK_OVERVIEW.md:1,5`.
- `docs/plan/01_PRODUCT_REQUIREMENTS.md:5`.
- `docs/plan/13_CODEX_MASTER_PROMPT.md:7`.
- `PRODUCT.md:8-24` defines users, purpose, and positioning around institutional compliance
  assessments and deterministic assessment receipts.
- `TASKS.yaml` phase names, benchmark gates, Studio work, and many task scopes assume the old
  compliance product.
- `codex-tasks/*` are delivery prompts for that old product.

Generic evaluator semantics and corpus-specific descriptions may legitimately retain “compliance”
where they describe an imported score, a historical methodology, or a specific G7/G20 adapter.
Those occurrences should not be mechanically rewritten into misleading language.

### `apps/studio` and Studio

- `README.md:14` names a nonexistent `apps/studio`.
- `apps/web/components/playground/writ-language.ts:5` cites the retired
  `apps/studio/public/app.js`.
- Studio product references remain in `TASKS.yaml`, `codex-tasks/07-studio.md`,
  `docs/plan/{08_SYSTEM_ARCHITECTURE,09_API_AND_UI,12_IMPLEMENTATION_ROADMAP,16_LIBRARY_AND_STANDARDS_MATRIX,18_DELIVERY_AND_ACCEPTANCE}.md`,
  and the root `studio` script aliases the active web app.

### Playground

“Playground” is still an active route and component family, not merely a stale doc reference:

- Active implementation: `apps/web/app/playground`, `components/playground`, `lib/toolchain.ts`,
  primary navigation, command menu, homepage/how-it-works/demo links, and tests.
- Configuration: `apps/web/next.config.ts`.
- Old product references: `PRODUCT.md` and `docs/PILOT.md`.

Later naming changes must update routes, typed routes, component names, command-menu links, tests,
tracing config, and generated comments together. This audit makes no naming change.

### `policy-test-*`

The EU–US frontend uses an old feature name even though it is now presented as a demo:

- Runtime/generator files: `apps/web/lib/{policy-test,policy-test-format,policy-test-data}.ts` and
  `apps/web/scripts/embed-policy-test.ts`.
- Imports: demo markdown/memo/prose, pilot assessments, record panel, and demo/how-it-works/home
  surfaces.
- Tests: `policy-test.test.ts`, `demo-memo.test.ts`, and frontend architecture tests.
- Build/config: `apps/web/package.json` and `.prettierignore`.

These names are path-sensitive generated-code inputs and should be renamed in a dedicated frontend
change, not bundled with corpus relocation.

## Baseline validation

The shell did not expose `bun` or Node on `PATH`; the pinned installed Bun binary at
`/Users/kimchee/.bun/bin/bun` was used. No dependency installation or network fetch was performed.

| Check | Result | Notes |
| --- | --- | --- |
| `bun run format` | pass | All matched files use Prettier style. |
| `bun run lint` | pass | All TypeScript workspaces pass. |
| `ruff check apps/ingest` | pass | No Python lint findings. |
| `bun run typecheck` | fail | `apps/web/.next/dev/types/validator.ts` retains ignored declarations for six routes deleted upstream (`benchmark`, `gap-matrix`, G7 lab member, `methodologies`, `receipts`, and benchmark API). Production build typechecking passes. |
| `mypy apps/ingest/src` | fail | The local environment lacks the `fitz` implementation/stub; one `import-not-found` error in `g20_rio.py`. |
| `bun run test` | pass | All workspace test commands exit 0; the FATF authoritative-country reproduction remains one declared `todo`. |
| `bun run conformance` | pass | 143 passed, 0 failed. |
| `bun run conformance:reference` | pass | Reference core checks 98 bounded assignments. |
| `bun run build` | pass | All packages build; Next production build compiles, typechecks, and generates 12 pages/routes. |
| `pytest -q` with no package path | fail | Nine collection errors because `writ_ingest` is not installed/on `PYTHONPATH`. |
| `PYTHONPATH=apps/ingest/src pytest -q` | fail | Two collection errors because the local venv lacks `fitz`. |
| Python tests not requiring PDF parser | pass | Pilot: 77; schema: 29; benchmark/API smoke: 8. |
| `emit_eu_us_ai_evaluation.py --check` | pass | Confirms 24 parents, 32 atomic claims, no pending/rejected review. |
| `emit_g20_rio.py --check` | environment-blocked | Cannot import `fitz`; checked-in counts were independently inspected without rewriting data. |
| `generate_source_registry.py --check` | pass | Generated JSON agrees with canonical YAML. |

The build regenerated `apps/web/lib/repo-provenance.ts` with the current commit as designed. That
single build-produced line was restored to `HEAD` immediately. No generated file is changed in this
branch.

## Reset risks and sequencing constraints

1. Archive the combined EU–US pilot before deriving active jurisdiction corpora, but do not let its
   question, headline rule, or comparison conclusion define either new corpus.
2. Introduce permanent deterministic IDs and a complete legacy-reference migration map before
   changing relationship targets.
3. Split authoritative G7/G20 knowledge from evaluator benchmark outputs; never treat published
   scores as Writ-derived facts.
4. Move schemas mechanically before changing semantics. Preserve schema versions and update `$id`,
   vendored copies, generators, tests, and manifests together.
5. Remove external Cepheus/Gap Matrix material entirely; first replace only the generic
   weighted-ordinal test coverage with synthetic Writ-owned fixtures.
6. Retire `reference-core` only after its parity role is absorbed into conformance.
7. Regenerate or replace `MANIFEST.sha256`; it already contains deleted paths and should not drive
   moves without verification.
8. Clear or regenerate ignored Next type output before interpreting root typecheck failures as
   source errors.

## Acceptance-gate confirmation

- No corpus, schema, or runtime file was moved.
- No corpus, schema, runtime, or generated file is changed.
- The only intended tracked addition is this audit document.
- Counts and the reviewed YAML hash match the runbook, so no data-mismatch blocker exists.
- Dependencies needed by later relocation and semantic PRs are identified above.
