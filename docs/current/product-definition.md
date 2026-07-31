# Current product definition

Writ is a structured, source-grounded knowledge system and domain-specific language for political
science and global affairs. It represents claims, institutions, laws, policies, theories, empirical
findings, evidence and relationships while preserving provenance, scope, uncertainty, contestation
and revision history. Questions are asked across corpora; they do not define corpora.

## Governing invariants

1. Questions are query-layer objects, not corpus identities.
2. Jurisdictional corpora exist independently of comparisons.
3. The core schema does not require commitments, obligations, or scores.
4. External ratings are source-reported judgments.
5. Writ-derived results declare their methodology, version, inputs, and trace.
6. Unknown and contested values remain explicit.
7. Visualizations and memos are views, not sources of truth.
8. The initial knowledge families are institutional, legal, policy, theoretical, and empirical.

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
- Every derived result can trace its decisive dependencies back to reviewed records and anchored
  evidence.

## Knowledge and analysis boundary

Corpora hold reviewed knowledge. Queries ask questions across one or more corpora. A methodology may
derive a comparison, classification, measure, or other result, but the result remains a named,
versioned analytical object with explicit inputs.

The shared core provides a small provenance and revision envelope. Institutional, legal, policy,
theoretical, and empirical families keep fields appropriate to their subject matter. A legal record
may need legal force and applicability; an empirical finding may need study design and population;
a theory may need propositions and scope conditions. None of those fields is universal merely
because one family needs it.

External scores and ratings remain statements made by their identified sources. Writ may reproduce
or analyze them, but a source-reported judgment and a Writ-derived result are different records.

## Current material

- The EU–US AI comparison is a pilot analysis over reviewed material. Its comparison question,
  headline rule, and conclusion do not define an EU or US corpus.
- G20 Rio records exist as multilateral political material. The current frozen review copy contains
  13 ingested statements and 546 source-reported member judgments; it explicitly records that 161
  reported commitments have not been ingested.
- G7 AI-for-SMEs score reproduction is a historical benchmark that tests deterministic derivation,
  provenance, and interpretation sensitivity.

## Explicit non-goals for the current reset

This definition does not design a complete political-science ontology. The current reset does not
add new country or constitutional corpora, political-psychology data, a chatbot, a graph database,
or a vector database.

## Historical plans

The former compliance-product build plan is preserved under
`archive/plans/compliance-product-v1/`. It remains useful history and contains reusable technical
work, but it is not normative.
