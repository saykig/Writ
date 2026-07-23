---
name: covenant-domain
summary: Domain rules for implementing the Covenant G7 compliance DSL, evaluator, evidence ledger, and static analyzer.
---

# Covenant Domain Skill

Use this skill when implementing or reviewing Covenant domain behavior.

## Mental model

Covenant has three governed layers:

1. normative methodology;
2. reviewed evidence;
3. deterministic evaluation receipt.

A report is generated from these layers.

## Epistemic separation

Never merge:

- source;
- fact claim;
- inference;
- interpretation;
- decision.

Workflow status and truth value are also separate.

## Truth logic

Use four values:

```text
true       supported true only
false      supported false only
unknown    neither supported
contested  both supported
```

Implement conjunction, disjunction, and negation according to `04_FORMAL_SEMANTICS.md`.

## Scoring

Evaluate all score branches. Select a unique highest-priority true branch. Equal-priority different results are unresolved. Unknown or contested branches that could change the result make the result unresolved unless the methodology explicitly resolves them.

## Counting

Count methodology identities, not rows. If membership or identity is uncertain, compute lower and upper bounds or require review. Do not guess.

## Evidence

Only frozen, eligible, accepted claims support a published run. Every score-decisive claim needs immutable source anchors and review history.

## Automation boundary

Models may propose candidates. Deterministic code and human decisions control accepted evidence and scores.

## Required benchmark defects

The analyzer must detect:

- the AI-for-SMEs one-to-four normalization gap and zero-to-four normalization overlap;
- counteraction overlap when precedence is not specified;
- exclusive classification overlap;
- missing count identity;
- decisive unknown evidence;
- prose and formal-rule mismatch fixtures.
