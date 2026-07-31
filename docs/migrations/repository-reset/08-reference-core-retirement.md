# Reference implementation retirement

**Status:** completed during the final repository-hygiene pass.

## Decision

The duplicate `reference-core/` TypeScript implementation was retired. It was not a production
runtime dependency: no application or published package imported `@writ/reference-core`. Its
remaining consumers were the root workspace, one parity test, the pack validator, the lockfile,
and documentation.

The retained semantic authority is implementation-independent:

- `conformance/cases/truth/` freezes four-valued truth and unknown propagation;
- `conformance/cases/expressions/interval-threshold.json` freezes interval comparison behavior;
- `conformance/cases/scoring/evaluate.json` freezes score selection and unresolved outcomes;
- `conformance/cases/scoring/analyze.json` freezes clean, gap, and overlap diagnostics and witnesses;
- `packages/conformance/` validates every case against the canonical packages;
- evaluator and analyzer unit tests retain exhaustive truth tables, score selection, static-analysis,
  witness, and deterministic replay coverage.

The former parity test added no independent behaviors beyond these frozen cases. Before removal,
its complete reference test surface was mapped to the conformance cases and canonical package tests.

## Atomic retirement

The hygiene change removed the reference package, its parity consumer, workspace and lockfile
wiring, and stale implementation comments together. `scripts/validate_pack.py` now runs the
implementation-independent conformance command instead of executing a second implementation.

No evaluator or analyzer behavior, diagnostic code, schema, protocol, corpus record, or expected
result changed as part of this retirement. The full conformance, unit, integration, typecheck, and
build gates must pass without `reference-core/` for this migration to remain valid.

The deleted implementation remains recoverable from Git history; history was not rewritten.
