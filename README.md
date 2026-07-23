# Covenant

Covenant is an auditable policy-evaluation compiler for G7 commitment compliance. It turns a
normative methodology, a reviewed evidence ledger, and explicit interpretation rules into a
deterministic, reproducible evaluation receipt with a proof tree and content hashes.

The textual DSL compiles into a typed canonical intermediate representation (IR). The IR,
the deterministic evaluator, the frozen evidence snapshot, and the receipt are the source of
truth — a rendered report is a view, never the record.

> Build the evaluator and evidence receipts to be trustworthy before making the language
> pleasant to write. See `AGENTS.md` for the non-negotiable invariants and `START_HERE.md`
> for the normative precedence order.

## Layout

- `packages/domain` — canonical types, schemas, identifiers, canonicalization, the diagnostic catalog.
- `packages/evaluator` — the deterministic four-valued runtime and proof construction.
- `packages/analyzer` — methodology lint, Z3 lowering, bounded gap/overlap witnesses.
- `packages/language` — Langium grammar, linker, formatter, AST→IR compiler, LSP.
- `packages/provenance` — RFC 8785 canonical JSON, SHA-256 hashing, snapshots, signatures.
- `packages/cli` — author and operator commands.
- `apps/api` — governed evidence + evaluation service (Fastify + OpenAPI).
- `apps/studio` — review and methodology authoring UI.
- `apps/ingest` — Python acquisition, parsing, anchoring, and candidate extraction.
- `db/migrations` — PostgreSQL schema and controlled migrations.
- `reference-core` — dependency-light executable specification for the hardest semantics (kept until `packages/evaluator` supersedes it).
- `specs/` — JSON Schemas, the EBNF, and the OpenAPI contract (interchange authority).
- `examples/`, `fixtures/`, `data/` — golden `.covenant`/IR/receipt examples, seeded defect fixtures, and the source registry.
- `docs/plan/` — the numbered product, semantics, and architecture specifications.
- `adr/` — architecture decision records.

The semantic packages (`domain`, `evaluator`, `analyzer`, `provenance`) must stay usable with no
network and no database.

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
bun run conformance    # the reference-core semantic conformance suite
bun run build          # tsc --noEmit (type gate; Bun executes source)
```

Database and object storage for the evidence ledger run via Docker Compose:

```bash
bun run db:up          # postgres:17 + minio
bun run db:down
```
