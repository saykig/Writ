# First decision-object proving case

This experiment tests whether Writ can preserve a decision problem's meaning while handing the
mathematics to established software.

The model is adapted from DecisionProgramming.jl's four-month Pig Breeding example. Each treatment
decision sees the current test result. Earlier test results are outside that decision's information
set.

## What is tested

The experiment now exercises four paths:

1. `direct_baseline.jl` — the donor model written directly in DecisionProgramming.jl;
2. `run_writ.jl` — the same model loaded from `case.json` through the Writ adapter;
3. `order_corruption_baseline.jl` — the same source tables deliberately inserted into the donor in a
   semantically wrong order; and
4. `memory_leak_baseline.jl` — a donor model whose later decisions receive extra earlier test results.

The two mutations test different boundaries. The table-order mutation keeps the source values and
model shape but changes which value table the donor associates with each value node. The information
mutation changes what a decision is allowed to know.

## Result

The direct donor model and the corrected Writ adapter return the same policy and the same exact
expected utility:

```text
7268121 / 10000 = 726.8121
```

The independent checker rejected both mutations:

- the order-corrupted lowering reported `952.77`, while its returned policy evaluates to `669.39`
  against the original Writ object;
- the full-memory model returned `729.225`, but its decision information sets differ from the original
  case.

The first failed adapter run exposed the table-order problem. DecisionProgramming had correctly
optimized the model it received; the adapter had changed the model's meaning while lowering it. The
exact checker caught the mismatch against the original decision object.

This establishes a useful first capability: Writ can keep a declared decision problem as the
reference point for checking a result even when the mathematical engine is correct about a different
lowered problem.

It does not establish a general decision-object schema. The next test is whether the useful structure
survives a second established engine.

## Donor stack

- DecisionProgramming.jl 2.0.1, commit `105a25ee898cc806db65d5b475e4f1a613265653`
- JuMP
- HiGHS
- Python `Fraction` for independent exact policy evaluation

DecisionProgramming.jl is MIT licensed. The model structure and numbers are adapted from its
`docs/src/examples/pig-breeding.md` example.

## Run

From this directory:

```sh
julia --project=. setup.jl
julia --project=. direct_baseline.jl
julia --project=. run_writ.jl case.json writ-result.json
julia --project=. order_corruption_baseline.jl
julia --project=. memory_leak_baseline.jl
python3 check.py
```

`check.py` evaluates policies independently from `case.json` with exact rational arithmetic and
checks the declared decision information sets.
