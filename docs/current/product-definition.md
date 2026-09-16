# Product definition

Writ is local infrastructure for explicit decision problems.

Its purpose is to make a bounded decision problem inspectable by both humans and software while
preserving the mathematical meaning of the tools used to solve or analyze it.

## The core object

A Writ decision object can state, when relevant:

- the variables in the problem;
- relationships or dependencies between them;
- what is uncertain;
- what information is available before each decision;
- the actions that can be chosen;
- constraints on those actions;
- the objective, value, loss, or other comparison rule;
- provenance for supplied inputs when it adds useful context;
- the exact request sent to a mathematical engine; and
- the returned result and any independent check.

The shared object grows from structure that proves useful in real cases. Engine-specific mathematics
stays in typed profiles.

## Mathematical engines

Established mathematical tools perform the mathematics they already implement well. Writ connects a
decision object to those tools through narrow adapters.

Influence diagrams, mathematical optimization, probabilistic graphical models, sequential decision
systems, statistical packages, and formal proof tools can each remain in their native ecosystem.

Writ owns the boundary around an engine: exact inputs, exact outputs, version and environment pins,
translation rules, supported and unsupported cases, and checks that can be performed independently.

## What a checked result means

A checked calculation establishes the claim that was actually checked. Mathematical validity,
real-world applicability, and human choice remain separate claims.

```text
supplied information
model and assumptions
mathematical request
engine result
independent check
real-world applicability
human decision
```

## Local proving path

The first build starts with one bounded case and one established engine. Writ creates only the
experimental representation and adapter required to test a useful semantic boundary, then compares
the result with using the donor engine directly.

A second mathematical system tests which successful structure generalizes. Shared schema fields are
promoted after that comparison.

## Existing repository components

`packages/decision-case/` is a narrow reference implementation for exact mathematical input binding
and independent checking. Source-grounded corpora and provenance packages remain available as inputs
when a decision problem needs them.
