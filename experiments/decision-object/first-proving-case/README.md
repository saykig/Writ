# First decision-object proving case

This experiment tests whether Writ can preserve a decision problem's information structure while
handing the mathematics to an established engine.

The model is adapted from DecisionProgramming.jl's four-month Pig Breeding example. The original
example is a limited-memory influence diagram: each treatment decision sees the current test result,
while earlier test results are absent from that decision's information set.

The experiment compares three paths:

1. `direct_baseline.jl` — the donor model written directly in DecisionProgramming.jl;
2. `run_writ.jl` — the same model loaded from `case.json` through an experimental Writ adapter; and
3. `memory_leak_baseline.jl` — a mathematically valid donor model that gives later decisions extra
   earlier test results.

The third path is deliberately a different decision problem. DecisionProgramming should solve it
normally. Writ should reject its result when it is presented as a result for `case.json`, because the
information available at the decisions has changed.

The experiment succeeds only if that boundary adds something material beyond calling the donor
engine directly.

## Donor

- DecisionProgramming.jl 2.0.1, commit `105a25ee898cc806db65d5b475e4f1a613265653`
- JuMP
- HiGHS

DecisionProgramming.jl is MIT licensed. The model structure and numbers are adapted from its
`docs/src/examples/pig-breeding.md` example.

## Run

From this directory:

```sh
julia --project=. setup.jl
julia --project=. direct_baseline.jl
julia --project=. run_writ.jl case.json writ-result.json
julia --project=. memory_leak_baseline.jl
python3 check.py
```

`check.py` evaluates the returned Writ policy independently with exact rational arithmetic and checks
that the adapter preserved every decision information set.
