# Second-family proving case: probabilistic model checking

This case tests Writ against a mathematical family that differs from the influence-diagram work.

The engine is Storm through `stormpy`. Storm performs the probabilistic model checking. Writ only
represents the bounded problem, lowers it to the engine, records the exact request, and checks the
returned scheduler against the original problem.

## Case

The model is adapted from Stormvogel's published `lion` MDP. The lion can `hunt >:D` or `rawr` while
moving between satisfied, full, hungry, starving, and dead states. The state `full` earns reward 100.

The declared question is:

```text
maximize expected accumulated reward until dead is reached
```

Storm property:

```text
Rmax=? [F "dead"]
```

The direct baseline uses Stormvogel's model and its Storm integration. The Writ path loads the same
substantive MDP from `case.json` and builds Storm's sparse MDP directly through `stormpy`.

## Why this case

The first proving family showed that a result can be mathematically correct for a wrongly translated
model. This case asks whether Writ also keeps the mathematical **request** fixed.

For probabilistic model checking, the transition model alone is incomplete. The answer also depends
on the property: reward model, optimization direction, and temporal stopping condition.

That gives this case a new boundary to test:

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

The adapter may use Storm-specific row groups, choice indices, and property syntax internally. Those
remain engine-profile details.

## Positive test

The direct Stormvogel baseline and the Writ-to-stormpy adapter must produce the same initial value and
an equivalent memoryless deterministic scheduler for the declared request.

A separate checker evaluates the scheduler from the original structured case with exact rational
arithmetic. Because this model has only four nonterminal decision states and two actions per state,
the checker may enumerate all 16 stationary deterministic policies to verify the optimum without
reimplementing Storm's general model checker.

## Negative tests

Two altered properties remain valid Storm questions but are different Writ requests.

1. `Rmin=? [F "dead"]` changes the optimization direction.
2. `Rmax=? [F "starving"]` changes the temporal stopping condition.

Storm should be allowed to solve both. Their results must be rejected when presented as answers to
the original `Rmax=? [F "dead"]` request.

## Falsification

This case does not earn a Writ capability if the direct Storm workflow already provides the same
useful binding and independent checking with no additional semantic boundary for Writ to preserve.

It also fails if the Writ adapter cannot reproduce the donor model, if result interpretation depends
on undocumented positional assumptions, or if the checker cannot state exactly which property it
verified.

## Donors

The execution will pin:

- `stormpy==1.14.0` / Storm 1.14.0;
- `stormvogel==0.12.0` for the direct model source and baseline.

Storm and Stormvogel are GPL-3.0 software. They are experiment dependencies, not copied into Writ.
The final result will record whether their licensing or installation burden argues against a durable
adapter.
