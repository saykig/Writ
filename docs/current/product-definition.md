# Current product definition

Writ makes political knowledge more inspectable, reviewable, provenance-preserving, and easier for
humans to reason from without replacing human judgment. Its current proving ground is the NIST
institutional corpus.

The immediate political-knowledge boundary is:

source -> passage -> typed record -> human review -> provenance

Writ may also carry a separate, versioned derived decision-case layer for explicit mathematical
problems, modelling choices, supported executions, checks, dependencies, and revisions. That layer
does not turn questions or analyses into source records and does not replace human reasoning.

## Governing invariants

1. Corpora and records exist independently of questions, comparisons, analyses, and presentation
   layers.
2. Human reasoning remains external to Writ. Questions are not first-class knowledge records. A
   derived decision case may state an intended question without governing corpus or record identity.
3. Institutional records keep identity, placement, mission, mandate, function, decision right, and
   operational capacity distinct. Evidence for one does not establish another.
4. The core schema does not require commitments, obligations, or scores.
5. External ratings are source-reported judgments.
6. Unknown and contested values remain explicit.
7. Visualizations and memos are views, not sources of truth.
8. The implemented native families are `legal_policy` and `institutional`; the shared record base
   remains extensible for future family profiles.
9. A checked mathematical result remains conditional on its exact problem, query and premises. Its
   mathematical status, evidentiary applicability, human disposition and authority to act are
   separate meanings.

## Technical strengths

- Compilation and verification are deterministic over frozen inputs and perform no network access, model inference,
  randomness, wall-clock reads, or mutation.
- Unknown and contested states remain explicit; unknown never silently becomes false.
- Content-addressed provenance makes source versions, passages, records, and exported bundles
  reproducible and tamper-evident.
- Human review controls acceptance. Models may propose candidates but do not accept evidence,
  resolve disputes, waive diagnostics, or publish derived results.
- Accepted records are superseded instead of silently rewritten.
- Stable diagnostics make semantic and provenance failures reviewable across versions.
- Pure decision-case validation, identity and dependency checks remain deterministic and do not
  execute external processes. Only an explicitly invoked runner may call a fixed pinned adapter;
  case content cannot supply a command.

## Knowledge and human-reasoning boundary

Corpora hold reviewed knowledge records. Research questions, comparisons, analyses, and answers do
not govern corpus or record identity. A separate derived decision-case namespace may preserve an
explicit intended question and conditional mathematical work, while Writ preserves the evidence,
modelling, checking, applicability, revision and review distinctions that humans may reason from.

The first derived profile is deliberately narrow: portable synthetic finite rational decision cases
checked through the pinned `finite-linear-uncertainty.v1` producer/checker boundary. It is not a new
record family, corpus type, acceptance workflow, empirical estimator, or general-purpose reasoning
language. Its proposed architectural authority is ADR 0026, which remains proposed until human
acceptance of the change.

The shared core provides a small provenance and revision envelope. The implemented institutional
and legal-policy family profiles keep fields appropriate to their subject matter, and future family
profiles may do the same. A legal-policy record may need legal force and applicability; neither
field is universal merely because one family needs it.

External scores and ratings remain statements made by their identified sources. They are not Writ
facts merely because the repository can preserve them.

## Current material

- The NIST institutional corpus is the current proving ground for typed records that distinguish
  identity, placement, mission, mandate, function, decision right, and operational capacity.
- NIST is the sole active development proving ground. Existing reviewed European Commission and
  legal-policy corpora remain catalogued, inspectable secondary material; they do not define the
  current development roadmap.
- Source-specific compatibility runtimes and archived benchmark consumers are not required merely
  because reviewed secondary corpora remain available. Generic catalog, bundle, schema, and
  verification support continues to preserve those corpora.

## Explicit non-goals

Writ is not a general question modeller, compliance engine, scoring engine, scenario engine, policy
reasoning engine, or autonomous answer-generating system. The bounded decision-case layer does not
infer problems from prose, choose empirical premises, invent model weights, accept evidence, or
authorize action. This definition does not design a complete political-science ontology or add new
country or constitutional corpora, political-psychology data, a chatbot, a graph database, or a
vector database.

## Recovery and future capability

The obsolete compliance-product and methodology-candidate planning directories were removed in the
foundation reset. They remain recoverable from Git history and the annotated
`pre-foundation-reset-2026-08-22` tag rather than as tracked archives on `main`.

Further analysis or interoperability capabilities must earn their way into the active architecture
through demonstrated need and an accepted decision. The bounded decision-case candidate does not
silently restore the retired compliance runtime or authorize a broader workspace.
