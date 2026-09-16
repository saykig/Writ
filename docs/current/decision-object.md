# Decision object

The decision object is Writ's main design target.

It describes one bounded decision problem well enough for another program to understand what is being
decided, which mathematical tool fits the problem, and what a returned result means.

## Conceptual shape

```text
problem
├─ variables
├─ relationships / information structure
├─ uncertainty
├─ actions
├─ constraints
├─ objective or value model
├─ provenance bindings, when useful
├─ engine request
└─ result + check
```

This shape guides the current proving work. The schema becomes more precise as useful cases exercise
it.

## Typed relationships

Each relationship carries its actual meaning. Causal relations, Bayesian-network edges, information
links, constraint references, and ordinary data dependencies stay distinct.

Uncertainty is typed in the same way. Probability distributions, intervals, finite model sets,
credal sets, and unknown values keep their own mathematical meaning.

Information structure is recorded separately from world state so the object can represent what is
known when a decision is made.

## Engine adapters

An adapter translates a supported decision object into one established engine request, runs or
receives the result, and returns a typed Writ result with the engine's meaning intact.

Each adapter records:

- supported Writ fields;
- native engine objects used;
- exact version and license;
- translation losses;
- supported and unsupported states;
- units and numeric representations;
- whether the engine produces a candidate, a proof, or both; and
- the independent checks Writ can perform.

Bindings at this boundary are semantic. Variables, nodes, states, table axes, information sets, and
other mathematical objects are bound by explicit identity and type. Container position is only an
implementation detail.

A returned result is checked against the original decision object as well as the engine output. This
keeps the declared problem as the reference point when an adapter or backend representation changes.

## Influence-diagram profile

The first proving case has now run through both DecisionProgramming.jl and pyAgrum. The following
structure transferred with the same meaning across both systems:

- stable node identities;
- chance, decision, and value node kinds;
- named states;
- decision information sets;
- conditional probability tables bound to named parents and states;
- value tables bound to named parents and states;
- policies mapping information states to actions; and
- expected utility as a checked result.

These fields currently form an influence-diagram profile. A different mathematical family is the
next test for deciding which parts belong in Writ's shared core.

## Versioned results

When inputs change, Writ can classify the effect on an existing result:

- the original result remains correct for the original problem;
- the mathematical problem changed and needs recomputation; or
- the mathematics remains valid while real-world applicability needs a new judgment.

The shared decision object should contain only the minimum structure earned by proving cases. More
advanced change tracking can be added when a concrete workflow needs it.
