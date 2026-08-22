---
name: writ-domain
summary: Domain rules for implementing Writ's source-grounded political-knowledge records, human review, and provenance.
---

# Writ Domain Skill

Use this skill when implementing or reviewing Writ domain behavior.

## Mental model

Writ's immediate governed flow is:

1. immutable source versions and anchored passages;
2. typed institutional and legal-policy records;
3. human review;
4. provenance that preserves the path back to the source.

Corpora and records exist independently of questions, comparisons, analyses, and presentation
layers. Questions and human reasoning remain external to Writ.

## Epistemic separation

Never merge:

- source;
- fact claim;
- inference;
- interpretation;
- decision.

Workflow status and truth value are also separate.

## Truth and uncertainty

Use four values where a proposition is evaluated:

```text
true       supported true only
false      supported false only
unknown    neither supported
contested  both supported
```

Never silently coerce `unknown` to `false` or `contested` to a single answer.

## Retained derivation runtime

Evaluator, analyzer, benchmark, and query-expression code remains in the repository pending later
dependency isolation. If touched, derivation stays deterministic over frozen inputs and retains its
methodology, version, inputs, and trace. This runtime does not define the current product boundary.
External ratings remain source-reported judgments and are never promoted to universal labels or
Writ facts.

## Counting

When a methodology counts entities or actions, count its declared identities, not rows. If
membership or identity is uncertain, compute lower and upper bounds or require review. Do not guess.

## Evidence

Only frozen, eligible, accepted records support a published derivation. Every decisive dependency
needs immutable source anchors and review history. Accepted records are superseded, never silently
rewritten.

## Automation boundary

Models may propose candidates. Deterministic code and human decisions control accepted knowledge
and derived results.

## Schema boundary

The shared core does not require commitments, obligations, legal force, or scores. Keep the
provenance envelope small and place family-specific fields in institutional, legal, policy,
theoretical, or empirical contracts.

For institutional records, keep identity, placement, mission, mandate, function, decision right,
and operational capacity distinct. Never infer one merely from evidence of another.

## Diagnostics

Return stable diagnostic codes for semantic gaps, ambiguity, missing provenance, invalid identity,
and incomplete traces. Do not renumber or repurpose released diagnostics silently.
