---
name: writ-decision-object
description: Define or review one bounded Writ decision object from explicit supplied structure.
---

# Decision object

Use this skill when defining the structure of a decision problem, reviewing a proposed schema, or
adding a typed decision profile.

## Role

Make the problem explicit before choosing the mathematical engine.

When relevant, identify:

- the decision question;
- variables and their types;
- uncertainty;
- information available before each decision;
- available actions;
- constraints;
- the objective, value, loss, or comparison rule; and
- provenance needed to explain a supplied input or modelling choice.

Keep causal relations, probabilistic dependencies, information links, constraints, and ordinary data
dependencies as distinct typed relationships.

Record supplied information, assumptions, mathematical claims, applicability, and human decisions
separately.

## Boundary

Represent missing probabilities, utilities, causal structure, constraints, authority, and values as
explicit unknown or unsupported states.

Engine-specific structure begins in a typed profile. Shared core fields are promoted after more than
one mathematical family demonstrates that the structure transfers.

When the mathematical operation is clear enough to choose a donor tool, hand the task to
`writ-engine-adapter`.

## Done when

The bounded problem is precise enough for an engine adapter to consume the variables, actions,
uncertainty, information, constraints, and objective directly from the decision object.
