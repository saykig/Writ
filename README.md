# Writ

Writ is infrastructure for making consequential decision-making more **inspectable, cumulative, and
correctable**.

It preserves the source and review trail behind institutional knowledge, and it is beginning to
preserve a separate class of derived mathematical decision results together with the exact models,
questions, assumptions, checks, applicability, and revisions that make those results usable.

## Current system

Writ has two deliberately separate surfaces.

### Source-grounded knowledge

```text
source
-> passage
-> typed record
-> human review
-> provenance
```

### Derived decision cases

```text
question / model / assumptions
-> exact mathematical subject
-> candidate calculation
-> independent check
-> applicability + human disposition
-> revision / reuse
```

The second surface does not turn an analysis into a source fact. A mathematical result can be
correct for its exact premises while being unsupported or inapplicable in a real decision context.
Writ preserves that distinction.

The first bounded implementation is the `derived_decision_case` integration merged in PR #43. It
uses a pinned Decision Lab checker for one finite-linear-uncertainty profile. It is a first stable
capability, not a general reasoning engine or final architecture.

## Bellman

Bellman is the mathematical research programme behind the decision semantics Writ will progressively
make executable. Bellman establishes objects, assumptions, operations, guarantees, composition
rules, failure boundaries, and provenance. Writ encodes and checks stable slices of that mathematics
and preserves how they are reused and corrected.

The current Python/TypeScript stack is a reference implementation, not a permanent language
commitment.

## Principles

- evidence and interpretation remain distinguishable;
- modelling choices are explicit rather than smuggled in as source facts;
- unknown, incompatible, unresolved, and tied are different states;
- exact results remain bound to the model, question, units, and information context that justify
  them;
- mathematical checking, evidentiary applicability, human review, and authority to act are separate;
- accepted records and derived case revisions remain historical snapshots rather than being silently
  rewritten;
- provenance is deterministic over frozen inputs;
- new mathematical capabilities earn their way into Writ through bounded, tested interfaces.

## What Writ is not

Writ is not currently an autonomous policy decision-maker, general recommendation engine, universal
political ontology, scenario simulator, causal inference engine, or authority system. It does not
invent probabilities, source reliabilities, preferences, or permission to act.

## Roadmap

The current roadmap is [`docs/current/roadmap.md`](./docs/current/roadmap.md). Its North Star is:

> **Make consequential decision-making mathematically inspectable, cumulative, and correctable.**

The long-term proving arena may include war, security strategy, intelligence, biosecurity, AI
governance, and other consequential domains. Those domains test the substrate; they do not define
its core abstraction.

Copyright 2026 Sara Kim
