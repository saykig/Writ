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

## Versioned results

When inputs change, Writ can classify the effect on an existing result:

- the original result remains correct for the original problem;
- the mathematical problem changed and needs recomputation; or
- the mathematics remains valid while real-world applicability needs a new judgment.

The first decision-object schema only needs the minimum structure required by the proving cases. More
advanced change tracking can be added when a concrete workflow needs it.

## First proving case

The first build starts with one established engine and one bounded case. Its purpose is to discover
whether Writ adds a useful semantic or checking boundary before a general schema is promoted.

The initial case uses a limited-memory influence diagram. The Writ object states the information
available at each decision. The adapter must preserve those information sets exactly, and the check
must detect a translated model or candidate policy that gains access to information that the original
decision did not have.

DecisionProgramming.jl with JuMP and HiGHS is the first donor candidate because it already represents
multi-stage influence diagrams with explicit information sets. A direct DecisionProgramming model
provides the baseline.

After the first case demonstrates a real advantage, a second mathematical system tests which parts
of the object generalize beyond that donor and which parts belong in a typed profile.
