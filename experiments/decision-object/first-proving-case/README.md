# First decision-object proving case

This experiment tests whether Writ can preserve a decision problem's meaning while handing the
mathematics to established software.

The model is adapted from DecisionProgramming.jl's four-month Pig Breeding example. Each treatment
decision sees the current test result. Earlier test results are outside that decision's information
set.

## Engines

The same `case.json` is solved through two independent stacks:

- DecisionProgramming.jl 2.0.1 with JuMP and HiGHS;
- pyAgrum 3.0.0 with Shafer-Shenoy LIMID inference.

The direct DecisionProgramming model provides the source baseline. Each Writ adapter translates the
same declared case into the engine's native representation.

## Semantic mutations

Two deliberately altered paths test the boundary:

1. `order_corruption_baseline.jl` inserts the same value tables into DecisionProgramming in a wrong
   semantic order;
2. `memory_leak_baseline.jl` gives later decisions extra earlier test results.

The first mutation changes which values belong to which nodes while preserving compatible table
shapes. The second changes what information is available when an action is chosen.

## Result

DecisionProgramming, the corrected Writ DecisionProgramming adapter, and the Writ pyAgrum adapter all
produce the same policy and the same independently checked expected utility:

```text
7268121 / 10000 = 726.8121
```

The policy is:

```text
D1: pass for either T1 result
D2: treat after positive T2; pass after negative T2
D3: treat after positive T3; pass after negative T3
```

The checker rejects both semantic mutations:

- the order-corrupted lowering reports `952.77`, while its returned policy evaluates to `669.39`
  against the original Writ object;
- the expanded-information model reports `729.225`, but its decision information sets describe a
  different decision problem.

The experiment therefore establishes a useful first capability: Writ can keep the declared decision
problem as the reference point for checking results produced by external mathematical systems.

`cross-engine-findings.md` records which structure transferred across both engines and which details
remain adapter-specific.

## Donor sources

DecisionProgramming.jl is pinned to commit
`105a25ee898cc806db65d5b475e4f1a613265653` and is MIT licensed. The model structure and numbers are
adapted from its `docs/src/examples/pig-breeding.md` example.

pyAgrum is pinned to version `3.0.0` and uses its `ShaferShenoyLIMIDInference` implementation.

Python `Fraction` evaluates each returned policy directly from `case.json`, independently of either
engine's reported objective.

## Run

From this directory:

```sh
julia --project=. setup.jl
julia --project=. direct_baseline.jl
julia --project=. run_writ.jl case.json writ-result.json
julia --project=. order_corruption_baseline.jl
julia --project=. memory_leak_baseline.jl
python -m pip install 'pyAgrum==3.0.0'
python pyagrum_adapter.py
python check.py
```

The next proving case should use a different mathematical family before broad shared Writ semantics
are promoted.
