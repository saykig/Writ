# Unified, versioned diagnostic catalog

Status: Accepted

## Context

The build pack ships three divergent diagnostic vocabularies for the same score defects:

- the reference evaluator emits runtime codes `COV-SCORE-DECISIVE-UNKNOWN`, `COV-SCORE-AMBIGUOUS`, `COV-SCORE-SAME-RESULT-OVERLAP`;
- the reference analyzer emits `COV-SCORE-GAP`, `COV-SCORE-OVERLAP`, `COV-SCORE-UNREACHABLE`, `COV-SCORE-UNKNOWN`;
- `docs/plan/05_STATIC_ANALYSIS.md` narrates `COV-SCORE-00N` codes;
- the checked-in scenario examples assert `expect diagnostic COV-SCORE-GAP` / `COV-SCORE-OVERLAP`.

`11_TEST_AND_VALIDATION.md` treats diagnostics as a versioned API product, so the codes must be one authoritative, stable set rather than three drifting ones.

## Decision

There is a single diagnostic catalog module in `packages/domain` (`diagnostics`). Every diagnostic has a stable code, a severity, a category (`syntax`, `type`, `semantic-lint`, `score-analysis`, `evaluation`, `provenance`), and a human message template. The catalog is versioned; codes are never renumbered or repurposed once released.

- **Static score-analysis codes** (surfaced by the analyzer and asserted by scenarios) keep the public names: `COV-SCORE-GAP`, `COV-SCORE-OVERLAP`, `COV-SCORE-UNREACHABLE`, `COV-SCORE-MONOTONICITY`.
- **Evaluation-time codes** (emitted by the deterministic evaluator over a concrete fact environment) stay distinct: `COV-EVAL-DECISIVE-UNKNOWN`, `COV-EVAL-AMBIGUOUS`, `COV-EVAL-SAME-RESULT-OVERLAP`.

The reference core's `COV-SCORE-DECISIVE-UNKNOWN` / `COV-SCORE-AMBIGUOUS` / `COV-SCORE-SAME-RESULT-OVERLAP` runtime codes are renamed to their `COV-EVAL-*` equivalents when its behavior is ported into `packages/evaluator`. The `COV-SCORE-00N` numbering in the prose spec is descriptive only and is superseded by the named codes here.

## Consequences

Scenario assertions and released receipts reference one stable code set. Static (methodology is defective regardless of evidence) and dynamic (this evidence environment is decisive-unknown) findings are never conflated, because a gap in a score program and an unknown fact are different facts about the world. Adding a diagnostic is an additive, versioned change; changing a code's meaning requires a new code.
