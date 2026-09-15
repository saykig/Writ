# Product definition

Writ is local infrastructure for explicit decision problems.

Its purpose is to make a bounded decision problem inspectable by both humans and software without
forcing every problem into one mathematical language.

## The core object

A Writ decision object should be able to state, when relevant:

- the variables in the problem;
- relationships or dependencies between them;
- what is uncertain;
- what information is available before each decision;
- the actions that can be chosen;
- constraints on those actions;
- the objective, value, loss, or other comparison rule;
- provenance for supplied inputs when provenance matters;
- the exact request sent to a mathematical engine; and
- the returned result and any independent check.

Not every problem needs every field. The first schema should contain only structure that proves
useful across more than one mathematical family.

## Mathematical engines

Writ should not become a general solver. It should connect to established tools whose mathematics
already fits the problem.

Examples worth testing include influence diagrams, mathematical optimization, probabilistic models,
partially observable sequential decisions, statistical systems, and formal proof tools. Each stays
responsible for its native mathematical meaning.

Writ owns the boundary around an engine: exact inputs, exact outputs, version and environment pins,
translation rules, unsupported cases, and checks that can be performed independently.

## What a checked result means

A checked calculation establishes only the claim that was actually checked. It does not establish
that the model describes reality, that its probabilities or preferences are correct, or that a human
should act on it.

Keep these separate:

```text
supplied information
model and assumptions
mathematical request
engine result
independent check
real-world applicability
human decision
```

## Local first

A complete proving case must run locally without an LLM or hosted service. LLMs may later help create
or inspect decision objects, but the object, engine execution, and checking path must stand on their
own.

## Existing repository components

`packages/decision-case/` is a narrow reference implementation for exact mathematical input binding
and independent checking. Source-grounded corpora and provenance packages remain available as inputs
when a decision problem needs them. Neither defines the full decision-object format.

## Non-goals

Writ is not currently a universal ontology, autonomous decision-maker, general workflow system,
solver registry, knowledge graph, forecasting system, or social-science model.
