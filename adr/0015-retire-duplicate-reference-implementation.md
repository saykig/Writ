# ADR 0015: Retire the duplicate reference implementation

**Status:** Accepted

## Context

`reference-core/` began as a small semantic oracle. By the repository reset, the canonical
evaluator and analyzer packages had behaviorally superseded it, while declarative cases under
`internal/verification/conformance/` independently froze the expected behavior. Keeping executable semantics in both
places created drift risk and made repository authority less clear.

The remaining reference package consumers were test and workspace wiring only. Its truth,
interval, score-selection, gap, overlap, and witness expectations were already represented by
implementation-independent conformance cases and broader canonical package tests.

## Decision

Retire `reference-core/` and its direct parity test atomically with all workspace, lockfile,
validation-script, and documentation consumers. Use `internal/verification/conformance/cases/` as the portable semantic
contract and `packages/conformance/` as the canonical runner.

Pack validation runs `bun run conformance`; it does not compare one implementation to another.
Canonical evaluator and analyzer tests continue to provide exhaustive and mutation-sensitive
coverage beyond the frozen cases.

## Consequences

- There is one active evaluator/analyzer implementation and one implementation-independent
  semantic contract.
- No build or test depends on an internal compatibility oracle.
- Alternative implementations can consume the declarative conformance cases without importing
  Writ runtime code.
- The retired source remains inspectable in Git history.

The coverage map and retirement record are preserved in
`docs/migrations/repository-reset/08-reference-core-retirement.md`.
