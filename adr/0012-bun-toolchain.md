# Bun as the JavaScript/TypeScript toolchain

Status: Accepted

## Context

The build pack scaffolds the monorepo on pnpm + Node + vitest (`pnpm-workspace.yaml`, corepack CI, `vitest run`). The project owner standardizes on Bun across their stack.

## Decision

The TypeScript monorepo uses **Bun** as package manager, runtime, and test runner.

- Workspaces are declared in the root `package.json` `workspaces` field; `pnpm-workspace.yaml` is removed.
- Recursive scripts use `bun run --filter '*' <script>`; `bun.lock` is the committed lockfile.
- Tests use Bun's built-in runner (`import { test, expect } from "bun:test"`).
- Bun executes TypeScript source directly, so internal packages resolve `@writ/*` to `./src/index.ts` via `exports`; `build`/`typecheck` are `tsc --noEmit` (type safety without a dist artifact to manage).
- CI uses `oven-sh/setup-bun` and `bun install --frozen-lockfile`.

This changes only the toolchain. It does not touch any semantic invariant in `AGENTS.md`, the formal semantics, or the JSON Schemas. `tsc` remains the type authority; ESLint and Prettier are unchanged.

## Consequences

`reference-core` is wired into the Bun workspace and its conformance test runs as `bun ./test/run-tests.ts`. The Python `apps/ingest` workspace, PostgreSQL migration job, and Docker Compose stack are unaffected. Any contributor guidance that says "pnpm" is superseded by "bun".
