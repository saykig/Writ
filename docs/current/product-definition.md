# Product definition

Writ is local infrastructure for explicit decision problems.

Its purpose is to make a bounded decision problem inspectable by humans and software while preserving
the mathematical meaning of the tools used to solve it.

## The core object

A Writ decision object can state, when relevant:

- the variables in the problem;
- relationships or dependencies between them;
- uncertainty;
- information available before each decision;
- available actions;
- constraints on those actions;
- the objective, value, loss, or comparison rule;
- provenance for important supplied inputs;
- the exact request sent to a mathematical engine; and
- the returned result and any independent check.

Fields enter the shared core after they prove useful across more than one mathematical family.
Engine-specific meaning stays in typed profiles.

## Mathematical engines

Writ connects decision objects to established mathematical software.

Useful families include influence diagrams, mathematical optimization, probabilistic models,
partially observable sequential decisions, statistical systems, simulation, and formal proof tools.
Each engine keeps its native mathematical meaning.

Writ owns the boundary around an engine: exact inputs, exact outputs, version and environment pins,
translation rules, supported states, and checks that can be performed independently.

## Checked results

A checked calculation certifies the exact mathematical claim that was checked.

Writ records the surrounding layers separately:

```text
supplied information
model and assumptions
mathematical request
engine result
independent check
real-world applicability
human decision
```

This keeps each conclusion tied to the evidence and assumptions that support it.

## Local execution

The correctness path runs locally from the decision object through engine execution and checking.
This makes proving cases reproducible from structured inputs and pinned software.

## Existing repository components

`packages/decision-case/` is the current reference implementation for exact mathematical input
binding and independent checking. Source-grounded corpora and provenance packages remain available
when a decision problem needs those inputs.
