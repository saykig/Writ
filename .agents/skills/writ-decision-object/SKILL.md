---
name: writ-decision-object
description: Define or review one bounded Writ decision object without inventing missing substance or forcing it into a solver.
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
dependencies distinct. Do not turn them into one generic edge type.

Keep supplied information, assumptions, mathematical claims, applicability, and human decisions
separate.

## Boundary

Do not invent missing probabilities, utilities, causal structure, constraints, authority, or values.
Use explicit unknown or unsupported states instead.

Do not add a core field merely because one engine needs it. Engine-specific structure belongs in a
typed profile until more than one mathematical family demonstrates that it is general.

When the mathematical operation is clear enough to choose a donor tool, hand the task to
`writ-engine-adapter`.

## Done when

The bounded problem is precise enough that an engine adapter can consume it without guessing what
the variables, actions, uncertainty, information, constraints, or objective mean.
