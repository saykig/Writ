# Writ

Writ is a structured, source-grounded knowledge system and domain-specific language for political
science and global affairs. It represents claims, institutions, laws, policies, theories, empirical
findings, evidence and relationships while preserving provenance, scope, uncertainty, contestation
and revision history. Questions are asked across corpora; they do not define corpora.

Writ separates durable knowledge from the questions asked of it. A jurisdiction, institution, or
research corpus exists on its own; comparisons, evaluations, visualizations, and memos are
reproducible views over one or more corpora.

The initial knowledge families are institutional, legal, policy, theoretical, and empirical. They
share provenance and revision conventions.
obligation, or score.

## Layout

- `packages/domain` — canonical types, schemas, identifiers, canonicalization, the diagnostic catalog.
- `packages/evaluator` — deterministic derivation, four-valued truth where applicable, and proof construction.
- `packages/analyzer` — static checks, bounded witnesses, and stable diagnostics.
- `packages/language` — Langium grammar, linker, formatter, AST→IR compiler, LSP.
- `packages/provenance` — RFC 8785 canonical JSON, SHA-256 hashing, snapshots, signatures.
- `packages/cli` — author and operator commands.
- `apps/api` — governed knowledge and derivation service (Fastify + OpenAPI).
- `apps/web` — active research, review, and demonstration interface.
- `apps/ingest` — source-specific acquisition, parsing, anchoring, normalization, and corpus
  validation.
- `db/migrations` — PostgreSQL schema and controlled migrations.
- `reference-core` — dependency-light executable specification for the hardest semantics (kept until `packages/evaluator` supersedes it).
- `specs/` — JSON Schemas, the EBNF, and the OpenAPI contract (interchange authority).
- `examples/`, `fixtures/`, `data/` — golden `.writ`/IR/receipt examples, seeded defect fixtures,
  source manifests, and generated registry artifacts.
- `config/` — canonical source and controlled-vocabulary registries.
- `schemas/` — current and compatibility interchange contracts; the existing summit-compliance
  family is not the universal Writ schema.
- `docs/current/` — current product definition and repository audit.
- `archive/plans/compliance-product-v1/` — superseded compliance-product planning history.
- `adr/` — architecture decision records.

The semantic packages (`domain`, `evaluator`, `analyzer`, `provenance`) must stay usable with no
network and no database.

## Current research material

- The EU–US AI comparison is a pilot analysis over reviewed records. Its question and conclusion do
  not define either jurisdiction's corpus.
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
