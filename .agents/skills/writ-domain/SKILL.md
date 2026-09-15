---
name: writ-domain
description: Apply Writ's current rules for local, explicit decision problems.
---

# Writ domain

Use this skill when implementing or reviewing Writ semantics.

## Mental model

Writ centers on one bounded decision problem. Depending on the problem, it may contain variables,
dependencies, uncertainty, information available, actions, constraints, objectives, provenance,
engine requests, and checked results.

Do not assume those objects belong to a particular application domain.

## Keep claims separate

Never silently merge:

- supplied information;
- a modelling assumption;
- a mathematical object;
- an engine result;
- an independent check;
- real-world applicability; and
- a human or institutional decision.

A correct calculation can still rest on a poor model. A useful model still does not grant authority
to act.

## External engines

Prefer established mathematics. An adapter must preserve the donor engine's native meaning and fail
on unsupported translations. Do not invent missing probabilities, utilities, constraints, causal
relations, or information structure.

The current `decision-case` package is a reference for exactness and checking, not the universal Writ
model.

## Provenance

Attach provenance when it answers a concrete question such as where a variable value, constraint,
objective, or model choice came from. Provenance supports the decision object; it does not determine
the mathematical semantics of the object it points to.

## Diagnostics

Return clear typed errors for malformed, unsupported, mismatched, or ambiguous inputs. Preserve
meaningful distinctions such as unknown versus false, unresolved versus incompatible, and exact tie
versus absence of a certified action.
