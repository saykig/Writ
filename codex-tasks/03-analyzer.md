# Implement publication-grade static analysis

## Instruction

Implement non-SMT linting first, then lower bounded Boolean, enum, integer, cardinality, and required-artifact expressions to Z3. Detect score gaps, overlaps, unreachable branches, unsafe otherwise clauses, missing action identity, attribution ambiguity, dimension and partner coverage defects, prose-to-metric mismatches, type/unit/time errors, and monotonicity counterexamples.

Acceptance: fixtures produce stable codes and minimized witnesses; literal AI-for-SMEs finds the expected gap and overlap; the resolved profile has neither; waivers are typed, scoped, expiring, and visible in releases.

## Non-goals

Do not redesign settled ADRs without opening a replacement ADR. Do not add broad infrastructure that is not required by the acceptance criteria. Do not hide incomplete behavior behind mocks in production paths.
