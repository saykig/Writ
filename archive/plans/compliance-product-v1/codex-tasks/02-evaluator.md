# Implement the deterministic evaluator

## Instruction

Port and expand `reference-core/` into `packages/evaluator`. Implement four-valued truth, typed expressions, temporal intervals, quantities, bounded counts, identity-aware queries, classifications, priorities, score selection, proof DAGs, and canonical receipts.

Acceptance: all reference tests pass; unknown and contested branches cannot silently fall through; same inputs and build produce byte-identical receipts; proof nodes name contributing claims, actions, passages, and rules.

## Non-goals

Do not redesign settled ADRs without opening a replacement ADR. Do not add broad infrastructure that is not required by the acceptance criteria. Do not hide incomplete behavior behind mocks in production paths.
