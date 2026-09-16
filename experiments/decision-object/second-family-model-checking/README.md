# Second-family proving case: probabilistic model checking

This case tests Writ against a mathematical family that differs from the influence-diagram work.

Storm performs the probabilistic model checking through `stormpy`. Writ represents the bounded
problem, lowers it to the engine, records the exact request, and checks the returned scheduler against
the original problem.

## Case

The model is adapted from Stormvogel's published `lion` MDP. The lion can `hunt >:D` or `rawr` while
moving between satisfied, full, hungry, starving, and dead states. The state `full` earns reward 100
in reward model `R`.

The Writ request is semantic:

```text
reward model: R
direction: max
stop state: dead
```

The direct Stormvogel baseline compiles that request to its native label:

```text
R{"R"}max=? [F "dead"]
```

The Writ-to-stormpy adapter uses stable engine labels derived from Writ state IDs. Storm property
syntax stays inside the adapter rather than becoming part of the shared decision object.

## Why this case

The first proving family showed that a result can be mathematically correct for a wrongly translated
model. This case asks whether Writ also keeps the mathematical request fixed.

For probabilistic model checking, the transition model alone is incomplete. The answer also depends
on the reward model, optimization direction, and stopping state.

```text
MDP + quantitative request -> scheduler + value
```

## Required bindings

The Writ case must bind:

- initial state;
- state identity and source labels;
- action identity;
- transition probabilities;
- reward-model identity and values;
- optimization direction; and
- stopping state identity.

Storm-specific row groups, choice indices, query labels, and property syntax remain inside the
adapter.

## Positive test

The direct Stormvogel baseline and the Writ-to-stormpy adapter must produce an equivalent memoryless
deterministic scheduler for the declared request.

A separate checker evaluates the scheduler from the original structured case with exact rational
arithmetic. The canonical model has four nonterminal decision states and two actions per state, so the
checker can enumerate all 16 stationary deterministic policies to verify the optimum without
reimplementing Storm's general model checker.

Storm uses a floating sparse model in this path. The checker therefore treats the returned scheduler
and the reported floating value as separate claims: it verifies scheduler optimality exactly and
records any numeric difference between Storm's value and exact evaluation from the source rationals.

## Negative tests

Two altered requests remain valid model-checking questions but answer something different.

1. Change `direction: max` to `direction: min` while keeping the MDP, reward model, and stop state.
2. Change `stop_state: dead` to `stop_state: starving` while keeping the MDP, reward model, and
   optimization direction.

The second mutation motivated an architecture correction during execution. The donor display label
for that state is `starving :((`, which Storm's property parser does not accept cleanly in this path.
Writ now binds the query to stable state identity and lets the adapter create an engine-safe query
label. Display-label syntax no longer determines whether the mathematical request is representable.

## Falsification

This case does not earn a Writ capability if the direct Storm workflow already provides the same
useful binding and independent checking with no additional semantic boundary for Writ to preserve.

It also fails if the Writ adapter cannot reproduce the donor model, if result interpretation depends
on undocumented positional assumptions, or if the checker cannot state exactly which semantic
request it verified.

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
