---
name: writ-domain
summary: Domain rules for implementing Writ's source-grounded political-science knowledge system, language, provenance, and deterministic derivations.
---

# Writ Domain Skill

Use this skill when implementing or reviewing Writ domain behavior.

## Mental model

Writ has governed layers that must remain distinct:

1. immutable source versions and anchored passages;
2. reviewed institutional, legal, policy, theoretical, and empirical records;
3. query-layer questions and explicit methodologies;
4. deterministic derived results with traces;
5. visualizations and memos as views.

Questions never define corpora. Jurisdictional corpora exist independently of comparisons.

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

## Derivation

Derivation is deterministic over frozen inputs. Every Writ-derived result declares its methodology,
version, inputs, and trace. External ratings remain source-reported judgments and are never promoted
to universal labels or Writ facts.

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

## Diagnostics

Return stable diagnostic codes for semantic gaps, ambiguity, missing provenance, invalid identity,
and incomplete traces. Do not renumber or repurpose released diagnostics silently.
