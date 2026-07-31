# Writ

Writ is a structured, source-grounded knowledge system and domain-specific language for political
science and global affairs. It represents claims, institutions, laws, policies, theories, empirical
findings, evidence and relationships while preserving provenance, scope, uncertainty, contestation
and revision history. A jurisdiction, institution, or research corpus exists on its own; comparisons, evaluations, visualizations, and memos are
reproducible views over one or more corpora.

The initial knowledge families are institutional, legal, policy, theoretical, empirical and
share provenance and revision conventions.

## Read these before changing the repository:

1. `AGENTS.md` for implementation invariants and working rules.
2. `docs/current/product-definition.md` for current product scope.
3. `TASKS.yaml` for the active change and acceptance gate.
4. Relevant current schemas and accepted ADRs.
5. `docs/current/repository-structure.md` before relocating existing material.

## What is normative

Use this precedence order when documents disagree:

1. `AGENTS.md` invariants, unless an accepted replacement ADR explicitly supersedes one.
2. `docs/current/product-definition.md`.
3. Accepted ADRs and current JSON Schemas.
4. Current protocol and language specifications.
5. Current product and task documents.
6. Examples and compatibility material.

Material under `archive/` is historical and non-normative.

## Working principles

- Keep jurisdictional corpora independent of comparisons and saved questions.
- Keep institutional, legal, policy, theoretical, and empirical records family-specific.
- Preserve unknown and contested values rather than coercing them.
- Treat external ratings as source-reported judgments.
- Make every Writ-derived result reproducible from named, versioned inputs and a trace.
- Treat visualizations and memos as views, never as source records.
- Supersede accepted records instead of silently rewriting them.

## Evidence warning

`config/source_registry.yml` contains connector candidates and research leads.
`data/source-registry.json` is its generated compatibility projection. A source's
`verification_status` is authoritative for operational readiness. Codex must not treat an entry
as production-ready merely because it appears in the registry.

## Repository map

The active source-of-truth areas are deliberately separated from analyses and history:

- `apps/` — product interfaces and source-specific ingestion.
- `corpora/` — active jurisdictional and multilateral political-science corpora.
- `schemas/` — sole active JSON Schema authority: core, extensions, analysis, and compatibility.
- `protocols/` — language EBNF and API OpenAPI protocol authority.
- `queries/` — reproducible inquiries over versioned corpora.
- `packages/` — shared domain, evaluator, analyzer, language, provenance, CLI, conformance, and
  benchmark runtime code.
- `docs/current/` — current product and technical guidance.
- `archive/` — non-normative historical pilots and plans worth preserving.

Supporting areas have narrower roles:

- `benchmarks/` — evaluator methodologies, expected derived results, and historical reproductions;
  never an authoritative political corpus.
- `conformance/` — implementation-independent semantic cases and expected outcomes.
- `adr/` — accepted architecture decisions.
- `config/` — reviewed source-registry and vocabulary inputs.
- `data/` — generated compatibility projections and runtime outputs, not a corpus authority.
- `db/` — PostgreSQL migrations.
- `examples/` and `fixtures/` — compiled examples and diagnostic test inputs.
- `scripts/` and `tests/` — repository automation and cross-package verification.

See [`docs/current/repository-structure.md`](docs/current/repository-structure.md) for ownership,
retention rules, and the completed cleanup decisions.

The semantic packages (`domain`, `evaluator`, `analyzer`, `provenance`) must stay usable with no
network and no database.

## Current research material

- The EU and US AI-governance corpora are independent jurisdictional corpora under `corpora/`.
  The former EU–US comparison survives only as an archived pilot analysis and saved query.
- The G20 Rio material contains 13 ingested political statements, two reports, and 546
  source-reported member judgments. The 161 un-ingested commitments remain explicitly absent.
- The G7 AI-for-SMEs score reproduction is a historical benchmark. Published ratings remain
  source-reported judgments; Writ-derived reproductions declare their methodology, inputs, version,
  and trace.

## Toolchain

This is a [Bun](https://bun.sh) workspace (package manager, runtime, and test runner). Bun runs
TypeScript source directly, so internal packages resolve to `src/` and `build`/`typecheck` are
`tsc --noEmit`.

```bash
bun install            # install workspace dependencies
bun run typecheck      # tsc --noEmit across all packages
bun run lint           # eslint
bun run format         # prettier --check
bun run test           # bun test across all packages
bun run conformance    # implementation-independent semantic conformance suite
bun run build          # tsc --noEmit (type gate; Bun executes source)
```

Database and object storage for the evidence ledger run via Docker Compose:

```bash
bun run db:up          # postgres:17 + minio
bun run db:down
```

## Rights and secrets

The repository does not currently declare a software or data license. Do not infer permission to
reuse code, reports, or source excerpts; third-party material remains subject to its publisher's
terms. Keep credentials in ignored local environment files based on `.env.example`, never in corpus
records, fixtures, logs, or commits.
