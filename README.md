# Writ

Writ is a structured, source-grounded knowledge system and domain-specific language for political
science and global affairs. It represents claims, institutions, laws, policies, theories, empirical
findings, evidence and relationships while preserving provenance, scope, uncertainty, contestation
and revision history. Questions are asked across corpora; they do not define corpora.

A jurisdiction, institution, or research corpus exists on its own; comparisons, evaluations, visualizations, and memos are
reproducible views over one or more corpora.

The initial knowledge families are institutional, legal, policy, theoretical, empirical and
share provenance and revision conventions.

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

Developer-only support is bounded under `internal/`: verification cases and benchmarks, maintenance
tooling, operational configuration, generated projections, and database migrations. Nothing under
`internal/` is a public corpus, normative schema, governing protocol, or primary demonstration.

`adr/` remains at the root because accepted decisions are active authority and stable corpus
identity metadata resolves to those paths. `.agents/` and `.github/` remain conventional discovery
locations for agent and GitHub automation.

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
