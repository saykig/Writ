# ADR 0022: Retire the compliance execution runtime

**Status:** Accepted

## Context

ADR 0021 narrowed Writ to evidence-bound political knowledge records while deferring removal of the
older compliance runtime until its dependencies were isolated. The audit found that native
`WritRecord` and `RecordJudgment` lowering does not depend on commitments, score programs, query
expressions, evaluation receipts, the evaluator, the analyzer, or the benchmark package.

## Decision

Writ retires the compliance execution runtime. The active language retains sources, concepts,
typed records, and review judgments; it no longer parses commitments, scoring rules, measures,
profiles, scenarios, or query expressions. Native records and judgments are the compiler's
authoritative outputs, with no replacement universal IR.

The evaluator, analyzer, benchmark, and compliance conformance packages are removed. The CLI is
limited to formatting, checking, and native compilation. API modules for execution snapshots,
evaluation receipts, discrepancies, and compliance releases are removed without redesigning the
remaining API.

The commitment-bound search-protocol implementation is also removed. ADR 0008's narrower principle
remains accepted: a negative evidence claim requires documented coverage and human review. A future
coverage-provenance contract must be justified by native record needs and must not reintroduce a
query or reasoning layer.

Archived G7, G20, and EU-US pilot material remains historical evidence. Generic canonical JSON
hashing, native schemas and compatibility record contracts remain active because they support
provenance and the present record boundary.

## Consequences

- Native NIST records compile without a commitment IR or execution packages.
- Historical compliance programs remain recoverable from Git history and the pre-reset tag.
- Future analysis, interoperability, or negative-coverage representations must earn their way back
  through demonstrated native-record need and an accepted decision.
- This decision supersedes active runtime portions of earlier decisions and documentation; it does
  not rewrite their historical context.
