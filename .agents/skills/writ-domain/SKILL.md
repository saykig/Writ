---
name: writ-domain
description: Apply Writ's current domain rules across source-grounded knowledge and bounded derived decision work.
---

# Writ Domain Skill

Use this skill when implementing or reviewing Writ domain behavior.

## Mental model

Writ has two separate but composable surfaces.

### Source-grounded knowledge

1. immutable source versions and anchored passages;
2. typed institutional and legal-policy records;
3. human review;
4. provenance and correction history.

### Derived decision work

1. an explicit question/requested operation;
2. supplied content and modelling assumptions;
3. an exact mathematical subject;
4. candidate computation and independent checking;
5. applicability and human disposition;
6. immutable revision/reuse history.

The derived layer may depend on reviewed Writ knowledge, but it never turns a question, model,
calculation, or recommendation into the source of truth for a native record.

Bellman supplies the mathematical semantics for mature decision primitives. Do not weaken Bellman
assumptions when implementing them in Writ, and do not treat today's implementation language as the
mathematical architecture.

## Epistemic separation

Never merge:

- source evidence;
- fact claim;
- interpretation;
- modelling assumption;
- mathematical guarantee;
- checked calculation;
- applicability;
- human disposition;
- authority to act.

Workflow status and truth value are also separate.

## Truth, compatibility, and uncertainty

Where the four-valued record truth profile applies, retain `true`, `false`, `unknown`, and
`contested` exactly. For mathematical/model status, also preserve distinctions such as compatible,
incompatible, unresolved/not established, identified, nonidentified, exact tie, and uncertified
action. Do not map these statuses into one another for convenience.

## Evidence and revision

Every native record needs the source/review history required by its state. Accepted records are
superseded, never silently rewritten.

Every derived result must remain bound to its exact mathematical subject and dependencies. A changed
source or modelling basis may leave the old mathematics correct while requiring applicability
reassessment. Preserve the old result and construct or check a successor rather than rewriting it.

## Automation boundary

Models and solvers may produce candidates. Independent checking establishes only the mathematical
claim within its supported semantics. Human or institutional authority controls acceptance and
real-world use.

## Schema boundary

The shared record core does not require commitments, obligations, legal force, or scores. Derived
decision cases live under separate analysis-layer contracts rather than becoming another record
family.

## Diagnostics

Return stable diagnostic codes for semantic gaps, ambiguity, missing provenance, invalid identity,
stale mathematical subjects, unsupported semantics, failed checking, and incomplete traces. Never
renumber or repurpose released diagnostics silently.
