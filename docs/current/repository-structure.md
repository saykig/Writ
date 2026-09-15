# Repository structure

The active tree is organized so current product direction is easy to find.

## Start here

- `README.md` — plain-language overview.
- `docs/current/` — current architecture and roadmap.
- `TASKS.yaml` — current execution ledger.
- `AGENTS.md` — rules for coding agents and contributors.

## Main code

- `packages/decision-case/` — narrow reference implementation for exact mathematical inputs and
  independent checking.
- `packages/provenance/` — mechanical provenance and hashing utilities.
- `packages/domain/` — current record and review types.
- `packages/language/` and `packages/cli/` — existing authoring and command-line tooling.
- `apps/ingest/` — source acquisition and corpus support used by current repository data tooling.

The decision-object architecture is not yet a new package. Its first schema and adapter should be
created only after the donor-tool comparison in the roadmap.

## Contracts and data

- `schemas/` is the JSON Schema authority.
- `protocols/` contains language protocol definitions.
- `corpora/` contains reviewed source-grounded data.
- `examples/` contains runnable examples, not product authority.

## Architecture and history

- `adr/` records architecture decisions. The newest accepted ADR governs new work when decisions
  conflict.
- `docs/history/`, `docs/migrations/`, and `docs/experiments/` preserve historical evidence. They
  should not be used as current implementation instructions.

## Internal support

- `internal/verification/` contains repository checks.
- `internal/tooling/` contains developer scripts.
- `.github/` contains CI.
- `.agents/` contains reusable contributor guidance.

Keep new surfaces small. A new package, schema family, language, or engine adapter needs a concrete
operation and a proving example before it becomes part of the active tree.
