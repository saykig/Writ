# Current product definition

Writ makes political knowledge more inspectable, reviewable, provenance-preserving, and easier for
humans to reason from without replacing human judgment. Its current proving ground is the NIST
institutional corpus.

The immediate system boundary is:

source -> passage -> typed record -> human review -> provenance

## Governing invariants

1. Corpora and records exist independently of questions, comparisons, analyses, and presentation
   layers.
2. Human reasoning remains external to Writ. Questions are not first-class Writ objects.
3. Institutional records keep identity, placement, mission, mandate, function, decision right, and
   operational capacity distinct. Evidence for one does not establish another.
4. The core schema does not require commitments, obligations, or scores.
5. External ratings are source-reported judgments.
6. Unknown and contested values remain explicit.
7. Visualizations and memos are views, not sources of truth.
8. The implemented native families are `legal_policy` and `institutional`; the shared record base
   remains extensible for future family profiles.

## Preserved technical strengths

- Derivation is deterministic over frozen inputs and performs no network access, model inference,
  randomness, wall-clock reads, or mutation.
- Four-valued truth is available where propositions require `true`, `false`, `unknown`, and
  `contested`; unknown never silently becomes false.
- Content-addressed provenance makes source versions, snapshots, methodologies, inputs, and results
  reproducible and tamper-evident.
- Human review controls acceptance. Models may propose candidates but do not accept evidence,
  resolve disputes, waive diagnostics, or publish derived results.
- Accepted records are superseded instead of silently rewritten.
- Stable diagnostics make semantic and provenance failures reviewable across versions.
- Retained evaluator, analyzer, benchmark, and query-expression code remains deterministic
  compatibility/runtime material; it does not define the current product boundary.

## Knowledge and human-reasoning boundary

Corpora hold reviewed knowledge records. Research questions, comparisons, analyses, and answers may
be created outside Writ, but they are not first-class Writ objects and do not govern corpus or record
identity. Writ preserves the evidence and review trail that humans may reason from.

The shared core provides a small provenance and revision envelope. The implemented institutional
and legal-policy family profiles keep fields appropriate to their subject matter, and future family
profiles may do the same. A legal-policy record may need legal force and applicability; neither
field is universal merely because one family needs it.

External scores and ratings remain statements made by their identified sources. They are not Writ
facts merely because the repository can preserve them.

## Current material

- The NIST institutional corpus is the current proving ground for typed records that distinguish
  identity, placement, mission, mandate, function, decision right, and operational capacity.
- The reviewed EU and US AI claims are distributed across issuer-and-instrument legal-policy
  corpora resolved through the native corpus catalog. The former EU–US
  comparison question, headline rule, and conclusion are preserved only in the archived pilot.
- G20 Rio records exist as multilateral political material. The current frozen review copy contains
  13 ingested statements and 546 source-reported member judgments; it explicitly records that 161
  reported commitments have not been ingested.
- G7 AI-for-SMEs score reproduction is a historical benchmark that tests deterministic derivation,
  provenance, and interpretation sensitivity.

## Explicit non-goals

Writ is not currently a question modeller, compliance engine, policy reasoning engine, or
answer-generating system. This definition does not design a complete political-science ontology or
add new country or constitutional corpora, political-psychology data, a chatbot, a graph database,
or a vector database.

## Recovery and future capability

The obsolete compliance-product and methodology-candidate planning directories were removed in the
foundation reset. They remain recoverable from Git history and the annotated
`pre-foundation-reset-2026-08-22` tag rather than as tracked archives on `main`.

Future analysis or interoperability capabilities must earn their way into the active architecture
through demonstrated need and an accepted decision.
