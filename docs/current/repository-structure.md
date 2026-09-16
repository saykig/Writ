# Repository structure

The active tree keeps current product direction easy to find.

## Start here

- `README.md` — plain-language overview.
- `docs/current/` — current architecture, principles, and roadmap.
- `TASKS.yaml` — current execution ledger.
- `AGENTS.md` — rules for coding agents and contributors.
- `.agents/README.md` — agent work chain and role boundaries.

## Main code

- `packages/decision-case/` — reference implementation for exact mathematical inputs and independent
  checking.
- `packages/provenance/` — mechanical provenance and hashing utilities.
- `packages/domain/` — current record and review types.
- `packages/language/` and `packages/cli/` — authoring and command-line tooling.
- `apps/ingest/` — source acquisition and corpus support used by repository data tooling.

The first decision-object schema and engine adapter will be created after the donor-tool comparison in
the roadmap.

## Agent skills

The build chain has three narrow skills:

- `writ-decision-object` — define the problem;
- `writ-engine-adapter` — connect the problem to established mathematics; and
- `writ-proving-ground` — test the resulting architecture against a direct-engine baseline.

`writ-release-history` handles releases and historical maintenance separately.

## Contracts and data

- `schemas/` is the JSON Schema authority.
- `protocols/` contains language protocol definitions.
- `corpora/` contains reviewed source-grounded data.
- `examples/` contains runnable examples.

## Architecture and history

- `adr/` records architecture decisions. The newest accepted ADR governs current architecture when
  decisions conflict.
- `docs/history/`, `docs/migrations/`, and `docs/experiments/` preserve historical evidence for audit,
  recovery, and later reference.

## Internal support

- `internal/verification/` contains repository checks.
- `internal/tooling/` contains developer scripts.
- `.github/` contains CI.
- `.agents/` contains the current agent roles.

New packages, schemas, languages, adapters, and agent roles enter the active tree after a concrete
operation and proving example justify them.
