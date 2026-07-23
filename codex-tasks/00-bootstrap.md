# Bootstrap the monorepo

## Instruction

Create the workspace from `repo-scaffold/`. Resolve current stable compatible dependencies, commit lockfiles, add CI for formatting, linting, type checks, unit tests, JSON Schema validation, Python tests, and migration checks. Copy all planning artifacts into `docs/plan/` but retain `AGENTS.md`, `TASKS.yaml`, `.agents/`, `specs/`, `examples/`, and `fixtures/` at root.

Acceptance: a clean checkout has one documented bootstrap command; CI is green; no semantic package requires the database or network; dependency versions and runtime versions are pinned.

## Non-goals

Do not redesign settled ADRs without opening a replacement ADR. Do not add broad infrastructure that is not required by the acceptance criteria. Do not hide incomplete behavior behind mocks in production paths.
