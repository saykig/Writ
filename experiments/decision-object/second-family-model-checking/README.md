# Second-family proving case: probabilistic model checking

This case tests Writ against a mathematical family that differs from the influence-diagram work.

Storm performs the probabilistic model checking through `stormpy`. Writ represents the bounded
problem, lowers it to the engine, records the exact request, and checks the returned scheduler against
the original problem.

## Case

The model is adapted from Stormvogel's published `lion` MDP. The lion can `hunt >:D` or `rawr` while
moving between satisfied, full, hungry, starving, and dead states. The state `full` earns reward 100
in reward model `R`.

The declared question is:

```text
maximize expected accumulated reward from R until dead is reached
```

Storm property:

```text
R{"R"}max=? [F "dead"]
```

The direct baseline uses Stormvogel's model and its Storm integration. The Writ path loads the same
substantive MDP from `case.json` and builds Storm's sparse MDP directly through `stormpy`.

## Why this case

The first proving family showed that a result can be mathematically correct for a wrongly translated
model. This case asks whether Writ also keeps the mathematical request fixed.

For probabilistic model checking, the transition model alone is incomplete. The answer also depends
on the reward model, optimization direction, and stopping condition.

```text
MDP + quantitative property -> scheduler + value
```

## Required bindings

The Writ case must bind:

- initial state;
- state identity and labels;
- action identity;
- transition probabilities;
- reward-model identity and values;
- optimization direction; and
- stopping label.

Storm-specific row groups, choice indices, and property syntax remain inside the adapter.

## Positive test

The direct Stormvogel baseline and the Writ-to-stormpy adapter must produce the same initial value and
an equivalent memoryless deterministic scheduler for the declared request.

A separate checker evaluates the scheduler from the original structured case with exact rational
arithmetic. This model has four nonterminal decision states and two actions per state, so the checker
can enumerate all 16 stationary deterministic policies to verify the optimum without reimplementing
Storm's general model checker.

## Negative tests

Two altered properties remain valid Storm questions but are different Writ requests.

1. `R{"R"}min=? [F "dead"]` changes the optimization direction.
2. `R{"R"}max=? [F "starving :(("]` changes the stopping condition.

Storm should solve both normally. Their results must stay distinct from the original
`R{"R"}max=? [F "dead"]` request.

## Falsification

This case does not earn a Writ capability if the direct Storm workflow already provides the same
useful binding and independent checking with no additional semantic boundary for Writ to preserve.

It also fails if the Writ adapter cannot reproduce the donor model, if result interpretation depends
on undocumented positional assumptions, or if the checker cannot state exactly which property it
verified.

## Donors

The execution pins:

- `stormpy==1.14.0` / Storm 1.14.0;
- `stormvogel==0.12.3` for the direct model source and baseline.

The first draft used Stormvogel 0.12.0. Its converter predates a Stormpy 1.14 state-valuation change
and fails on this variable-free model. Stormvogel 0.12.3 keeps the same lion example, fixes that
converter path, and declares compatibility with Stormpy 1.13.2 and newer.

Storm and Stormvogel are GPL-3.0 software. They are experiment dependencies, not copied into Writ.
The final result will record whether their licensing or installation burden argues against a durable
adapter.
