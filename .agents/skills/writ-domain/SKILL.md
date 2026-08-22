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
layers. Questions and human reasoning remain external to Writ. NIST is the sole active development
proving ground. Existing reviewed European Commission and legal-policy corpora remain
catalogued secondary material without setting the current product direction.

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

External ratings remain source-reported judgments and are never promoted to universal labels or
Writ facts.

## Evidence

Every record needs immutable source anchors and review history appropriate to its state. Accepted
records are superseded, never silently rewritten.

## Automation boundary

Models may propose candidates. Human decisions control accepted knowledge.

## Schema boundary

The shared core does not require commitments, obligations, legal force, or scores. Keep the
provenance envelope small and place family-specific fields in institutional, legal, policy,
theoretical, or empirical contracts.

For institutional records, keep identity, placement, mission, mandate, function, decision right,
and operational capacity distinct. Never infer one merely from evidence of another.

## Diagnostics

Return stable diagnostic codes for semantic gaps, ambiguity, missing provenance, invalid identity,
and incomplete traces. Do not renumber or repurpose released diagnostics silently.
