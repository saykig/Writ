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
├── archive/
│   └── pilots/
│       └── eu-us-ai-evaluation-v1/
├── corpora/
│   └── jurisdictions/
│       ├── eu/ai-governance/
│       └── us/ai-governance/
├── reference-core/
│   ├── src/
│   └── test/
├── schemas/
├── scripts/
├── protocols/
└── tests/
    ├── benchmarks/
    ├── fixtures/
    ├── ingestion/
    ├── corpora/
    └── schema/
```

There is no tracked `apps/studio/`. The root README and one web source comment still name it.

## Authoritative datasets and generated copies

“Authoritative” means the checked-in reviewed or source-grounded input. “Generated” means a
reproducible projection, normalized graph, build embed, or computed comparison. A generated
artifact can still be frozen and reviewable; it is not the place where later corrections begin.

| Knowledge material | Authoritative or source-grounded input | Generated or derived copies | Current consumers and checks |
| --- | --- | --- | --- |
| EU and US AI-governance corpora | The hash-pinned reviewed input is preserved at `archive/pilots/eu-us-ai-evaluation-v1/original/annotations/human-reviewed.yaml`; independent active records live at `corpora/jurisdictions/{eu,us}/ai-governance/`. | The archive retains the original normalized comparison outputs, methodology, provenance, and snapshots. Active corpora are deterministic projections from `scripts/migrate_eu_us_corpora.py`; web comparison views read the archived saved query. | Corpus migration tests and generator drift checks; web demo, memo, globe, Playground toolchain, and web tests. |
| G20 Rio 2024 | Frozen report excerpts in `benchmark/2024-rio-g20/sources/*.pdf`, their `sources.json`, canonical source policy in `config/source_registry.yml`, and reviewed vocabulary in `config/corpus_vocabulary.yml`. | Six files in `benchmark/2024-rio-g20/normalized/`, emitted by `scripts/emit_g20_rio.py`; `data/manifests/g20/2024-rio/*` records acquisition/reconciliation metadata. | `G20RioAdapter`, corpus validators, schema tests, ingestion tests, publishing scripts, and stale web tracing configuration. |
| G7 2025 AI-for-SMEs | Frozen report PDF, reviewed action catalog in `packages/benchmark/src/members.ts`, methodology/rubric inputs, reviewed tally, and published labels. The action catalog says every action is grounded in the frozen chapter. | `sources.json`, `methodology-inventory.json`, eight evidence snapshots, and two profiles from `packages/benchmark/src/generate.ts`; `discrepancy-ledger.json` from the benchmark runner. | `packages/benchmark`, G7 adapter, conformance tests, examples, and stale web tracing configuration. |
| Source registry | `config/source_registry.yml` plus `schemas/compatibility/compliance-corpus-v2/source_registry_config.schema.json`. | `data/source-registry.json`, checked by `scripts/generate_source_registry.py --check`; `data/source-registry-summary.md` is descriptive output. | Ingest registry policy, API seeding/publishing, G7/G20 adapters, tests. |
| Schema and protocol contracts | `schemas/{core,extensions,analysis,compatibility}/`, `protocols/language/writ.ebnf`, and `protocols/api/openapi.yaml`. | Drift-guarded schema vendor copies in `packages/domain/schemas/`; generated TS in `packages/domain/src/generated/`; generated embed `packages/domain/src/schemas.embedded.ts`; example JSON under `examples/`. | Domain validation/generation, compiler/evaluator packages, conformance, API, CLI, tests. |
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

`archive/pilots/eu-us-ai-evaluation-v1/original/annotations/human-reviewed.yaml` SHA-256:

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

`schemas/` is now the only active JSON Schema authority. Its core, extension, analysis, and
versioned compatibility layers are indexed in `schemas/README.md`; the complete relocation table is
`docs/current/schema-protocol-path-map.md`. Language and API contracts live under `protocols/`.

All current schemas use draft 2020-12 and only local `#/$defs/...` references. Runtime copies under
`packages/domain/schemas/` are drift-guarded vendors, not a second authority. The G7/G20
summit-compliance schemas remain unchanged in meaning and version under
`schemas/compatibility/compliance-corpus-v2/`.

### EU–US pilot-local contracts

| File | Governs | Consumer |
| --- | --- | --- |
| `archive/pilots/eu-us-ai-evaluation-v1/original/schemas/reviewed_dataset.schema.json` | Preserved reviewed YAML shape, including parent rows and distinct child claims. | Archived reference code and active corpus migration tests. |
| `archive/pilots/eu-us-ai-evaluation-v1/original/schemas/normalized_claim.schema.json` | Each historical generated atomic claim. | Archived reference code/tests. |
| `archive/pilots/eu-us-ai-evaluation-v1/original/schemas/headline_judgments.schema.json` | Historical generated comparison result. | Archived reference code/tests and saved frontend query. |

The pilot contracts are self-contained and use only local `$defs`. They are not extensions of the
summit-compliance schemas.

## Planned-move dependency map

Inspect and update these callers before any later relocation:

| Planned material | Path-dependent code and configuration |
| --- | --- |
| EU–US pilot archive and independent EU/US corpora (completed) | Historical builders/tests are under `archive/pilots/eu-us-ai-evaluation-v1/`; active generation is `scripts/migrate_eu_us_corpora.py`; web saved-query consumers point to the archive. |
| G20 into `corpora/multilateral/g20/2024-rio` | `G20RioAdapter.SOURCES_FIXTURE`; `scripts/emit_g20_rio.py`; `scripts/validate_corpus.py`; `scripts/publish_corpus.ts`; ingestion/schema tests; `apps/web/next.config.ts`; data manifest references; source registry/vocabulary IDs. |
| G7 into `corpora/multilateral/g7/2025-ai-sme` and score reproduction under `benchmarks/evaluator/` | `packages/benchmark/src/{paths,methodology,generate,run,members,evidence}.ts`; benchmark tests; G7 adapter; `scripts/{replicate.ts,demo.sh,validate_corpus.py}`; `apps/web/next.config.ts`; examples and discrepancy ledger references. |
| `examples/` and `fixtures/` cleanup | language/CLI/analyzer/domain/benchmark tests; `scripts/demo.sh`; `scripts/validate_pack.py`; web tracing comments/config; conformance parity tests. |
| `reference-core/` retirement | root workspaces/scripts; `VALIDATION.md`; `scripts/validate_pack.py`; `packages/conformance/test/canonical-parity.test.ts` direct dynamic import; analyzer/evaluator comments and parity fixtures; ADR 0012. |
| Docs/ADRs to target locations | Root links, `AGENTS.md` required-reading paths, `TASKS.yaml`, `START_HERE.md`, `README.md`, `codex-tasks/*`, CI/document validation. |

## Major-directory classification

| Path | Classification | Reset decision/evidence |
| --- | --- | --- |
| `apps/api` | current | Active Fastify application. |
| `apps/ingest` | current | Active acquisition/normalization code, including G7/G20 adapters and the EU/US corpus migration. |
| `apps/web` | current, with generated and stale compatibility areas | Active Next app. `lib/frozen-data.ts`, `policy-test-data.ts`, and `repo-provenance.ts` are generated. `policy-test-*`, Playground naming, deleted-route traces, and compliance-first copy need later semantic cleanup. |
| `packages/{domain,evaluator,analyzer,language,provenance,cli,conformance}` | current | Production semantic/compiler stack. |
| `packages/benchmark` | current analysis capability with path-bound corpus code | Preserve evaluator reproduction capability; separate source corpus from benchmark outputs. |
| `schemas` | current authority | Sole JSON Schema authority, split into core, extensions, analysis, and versioned compatibility layers. |
| `protocols` | current authority | Language EBNF and API OpenAPI protocol contracts. |
| `archive/pilots/eu-us-ai-evaluation-v1` | historical archive | Byte-preserved combined pilot, original methodology, provenance, generated outputs, reference code/tests, and checksum manifest. |
| `corpora/jurisdictions/{eu,us}/ai-governance` | current source-of-truth corpora | Independent active corpora with deterministic identities and complete legacy-reference maps. |
| `benchmark/2024-rio-g20` | current source corpus in the wrong category/path | Reclassify as multilateral political corpus. |
| `benchmark/2025-ai-sme` | mixed source corpus and generated benchmark | Split authoritative G7 knowledge from score-reproduction benchmark. |
| `benchmark/fatf-mutual-evaluation` | example/fixture candidate | No authoritative country result corpus; reproduction test is `todo`. |
| `data` | mixed generated/compatibility/current metadata | Source registry JSON is generated; G20 manifest is operational metadata; empty/README-only raw/normalized areas should not be recreated until they hold real material. |
| `examples` | mixed teaching examples | Keep small Writ-owned examples; move corpus-like material out. |
| `fixtures` and `tests/fixtures` | current synthetic/broken test inputs | Keep Writ-owned fixtures for generic behavioral coverage. |
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

## External product removal decision

The reset identified a source-specific weighted-ordinal product and its derived
corpus, generator, example, benchmark, documentation, and web copy for complete
removal rather than in-repository archival. Generic weighted-ordinal evaluation
and structural analyzer behavior remain useful and should be covered only with
small Writ-owned synthetic fixtures.

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
| `bun run typecheck` | fail | `apps/web/.next/dev/types/validator.ts` retains ignored declarations for deleted upstream routes. Production build typechecking passes. |
| `mypy apps/ingest/src` | fail | The local environment lacks the `fitz` implementation/stub; one `import-not-found` error in `g20_rio.py`. |
| `bun run test` | pass | All workspace test commands exit 0; the FATF authoritative-country reproduction remains one declared `todo`. |
| `bun run conformance` | pass | 143 passed, 0 failed. |
| `bun run conformance:reference` | pass | Reference core checks 98 bounded assignments. |
| `bun run build` | pass | All packages build; Next production build compiles, typechecks, and generates 12 pages/routes. |
| `pytest -q` with no package path | fail | Nine collection errors because `writ_ingest` is not installed/on `PYTHONPATH`. |
| `PYTHONPATH=apps/ingest/src pytest -q` | fail | Two collection errors because the local venv lacks `fitz`. |
| Python tests not requiring PDF parser | pass | Pilot: 77; schema: 29; benchmark/API smoke: 8. |
| `scripts/migrate_eu_us_corpora.py --check` | pass | Confirms 24 imported parent reviews, 32 atomic claims, and deterministic active projections. |
| `emit_g20_rio.py --check` | environment-blocked | Cannot import `fitz`; checked-in counts were independently inspected without rewriting data. |
| `generate_source_registry.py --check` | pass | Generated JSON agrees with canonical YAML. |

The build regenerates `apps/web/lib/repo-provenance.ts` with the current commit as designed; that
build-only stamp is restored after validation. Prompt 5 intentionally regenerates the frontend
embeds and source-registry projection from their relocated authoritative inputs.

## Reset risks and sequencing constraints

1. The combined EU–US pilot is archived; its question, headline rule, and comparison conclusion do
   not define either active corpus.
2. Permanent deterministic IDs and complete legacy-reference migration maps now govern active
   relationship targets.
3. Split authoritative G7/G20 knowledge from evaluator benchmark outputs; never treat published
   scores as Writ-derived facts.
4. Move schemas mechanically before changing semantics. Preserve schema versions and update `$id`,
   vendored copies, generators, tests, and manifests together.
5. Remove source-specific external product material entirely while preserving generic
   weighted-ordinal test coverage with synthetic Writ-owned fixtures.
6. Retire `reference-core` only after its parity role is absorbed into conformance.
7. Keep `MANIFEST.sha256` and the pilot archive checksum manifest synchronized with tracked
   relocations; stale paths must not drive moves without verification.
8. Clear or regenerate ignored Next type output before interpreting root typecheck failures as
   source errors.

## Original Prompt 1 acceptance-gate confirmation

The following records the audit-only gate as it stood before the later reset steps changed paths:

- No corpus, schema, or runtime file was moved.
- No corpus, schema, runtime, or generated file is changed.
- The only intended tracked addition is this audit document.
- Counts and the reviewed YAML hash match the runbook, so no data-mismatch blocker exists.
- Dependencies needed by later relocation and semantic PRs are identified above.
