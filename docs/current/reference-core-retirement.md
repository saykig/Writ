# `reference-core` retirement proposal

## Finding

The current `packages/evaluator` and `packages/analyzer` implementations behaviorally supersede the
dependency-light `reference-core` for production. No application imports `@writ/reference-core`.
However, the package still has active consumers and cannot be deleted safely in this branch:

- `packages/conformance/test/canonical-parity.test.ts` dynamically imports
  `reference-core/src/index.ts`;
- the root workspace and lockfile include the package;
- `conformance:reference` and `scripts/validate_pack.py` execute it;
- ADR 0012 and implementation comments record its parity role.

## Migration path

1. Convert the parity inputs and expected truth, score, and witness outputs into
   implementation-independent conformance fixtures.
2. Make the canonical packages pass those fixtures without dynamically importing `reference-core`.
3. Preserve the existing truth-table, unknown propagation, score selection, gap/overlap witness,
   and deterministic replay coverage.
4. Remove the root workspace entry, lockfile entry, `conformance:reference` command, pack-validation
   invocation, and stale implementation comments in one retirement change.
5. Run conformance, unit tests, typecheck, and build before deleting `reference-core/`.

Until that gate is complete, `reference-core` remains a compatibility test oracle, not production
authority.
