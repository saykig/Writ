# ADR 0021: Foundation reset to evidence-bound records

**Status:** Accepted

## Context

Writ's saved-query and compliance-product direction made analysis appear to be part of the product
boundary before the underlying political knowledge records had proven their value. The NIST
institutional corpus provides a narrower test: preserve what sources support about an institution
without collapsing identity, placement, mission, mandate, function, decision right, or operational
capacity.

## Decision

Writ's current focus is inspectable, evidence-bound political knowledge records. The immediate
boundary is source -> passage -> typed record -> human review -> provenance. Human reasoning remains
external to Writ, and questions are not first-class Writ objects. Corpora and records exist
independently of questions, comparisons, analyses, and presentation layers.

The NIST institutional corpus is the current proving ground. Future analysis and interoperability
capabilities must earn their way back into the active architecture through demonstrated need and an
accepted decision.

This decision supersedes the active saved-query and compliance-product direction. It does not remove
or change retained evaluator, analyzer, benchmark, language, schema, corpus, or runtime compliance
semantics; those require later dependency-isolation work. Obsolete compliance and methodology
planning is recoverable through Git history and the annotated
`pre-foundation-reset-2026-08-22` tag rather than retained on `main`.

## Consequences

- `queries/` and its dedicated integration tests are removed.
- Governing documentation describes the evidence and review boundary, not an answer pipeline.
- No NIST record, schema, corpus semantic, canonical IR, or retained runtime compliance behavior
  changes in this reset.
