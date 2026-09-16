# Cross-engine findings

The same `case.json` was executed through two independent mathematical systems:

- DecisionProgramming.jl 2.0.1 with JuMP and HiGHS;
- pyAgrum 3.0.0 with `ShaferShenoyLIMIDInference`.

Both produced the same policy and the same checked expected utility:

```text
7268121 / 10000 = 726.8121
```

## Structure that transferred

The following information survived both adapters with the same meaning:

- stable node identities;
- node kind: chance, decision, or value;
- named states for chance and decision nodes;
- the information available at each decision;
- conditional probability tables bound to named parents and states;
- value tables bound to named parents and states;
- a policy mapping each declared information state to an action;
- expected utility as the result being checked; and
- engine identity and version attached to the returned result.

These fields are strong evidence for an influence-diagram profile in Writ.

## Engine-specific structure

DecisionProgramming uses ordered internal collections, generates an optimization model through JuMP,
and delegates the solve to HiGHS. Its model-generation options and table insertion requirements belong
to that adapter.

pyAgrum builds an influence-diagram graph directly and solves the LIMID with Shafer-Shenoy inference.
Its tensor representation, inference API, and optional no-forgetting machinery belong to the pyAgrum
adapter.

## Adapter invariant earned by the case

A Writ adapter binds mathematical content by explicit identity and typed relationship. Container
position is never the only carrier of meaning.

The first DecisionProgramming lowering violated this rule. It inserted value tables in a different
order from the declared value nodes. The donor engine then optimized a different model successfully
and reported `952.77`. The independent checker evaluated the returned policy against the original
Writ object and obtained `669.39`, exposing the mismatch.

A second mutation expanded the information available to later decisions. That model is mathematically
valid and has expected utility `729.225`, but its result belongs to a different decision problem. The
checker rejects it against the original information sets.

## What comes next

DecisionProgramming and pyAgrum use different computational approaches, but both operate in the
influence-diagram/LIMID family. The next proving case should use a different mathematical family.
That case will determine which parts of this profile belong in Writ's shared decision object and
which remain specific to influence diagrams.
