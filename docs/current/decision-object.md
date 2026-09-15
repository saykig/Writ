# Decision object

The decision object is Writ's main design target.

It should describe one bounded decision problem well enough that another program can understand what
is being decided, which mathematical tool is appropriate, and what a returned result is allowed to
mean.

## Conceptual shape

```text
problem
├─ variables
├─ relationships / information structure
├─ uncertainty
├─ actions
├─ constraints
├─ objective or value model
├─ provenance bindings, when needed
├─ engine request
└─ result + check
```

This is a conceptual shape, not a frozen schema.

## Important distinctions

A dependency can mean different things. A causal edge, a Bayesian-network edge, an information edge,
a constraint reference, and a simple data dependency are not interchangeable. The object must name
the relation it actually means rather than treating every connection as a generic graph edge.

The same applies to uncertainty. A probability distribution, an interval, a finite model set, a
credal set, and an unknown value are different mathematical objects. Writ should preserve the donor
engine's distinction instead of translating them into one universal uncertainty type.

Information structure matters separately from uncertainty: what the world contains and what the
decision-maker knows at a particular point are not the same thing.

## Engine adapters

An adapter should be thin. It translates a supported Writ object into one established engine request,
runs or receives the result, and returns a typed Writ result with the engine's meaning intact.

Before an adapter is accepted, it must document:

- supported Writ fields;
- native engine objects used;
- exact version and license;
- translation losses;
- unsupported states;
- units and numeric representations;
- whether the engine produces a candidate, a proof, or both; and
- what Writ can check without trusting the producer.

## First design test

Do not freeze `decision-object-v0.1` from one library. First express bounded problems through at least
two established mathematical systems. Candidate donors include DecisionProgramming.jl with JuMP,
pyAgrum influence diagrams, and later POMDP tooling when a genuinely sequential problem requires it.

The schema should emerge from structure that survives those comparisons.
