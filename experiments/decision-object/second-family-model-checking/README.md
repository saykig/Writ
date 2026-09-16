# Second-family proving case: probabilistic model checking

This case tests Writ against a mathematical family that differs from the influence-diagram work.

Storm performs probabilistic model checking through `stormpy`. Writ represents the bounded problem,
lowers it to the engine, records the semantic request, and checks the returned scheduler against the
original problem.

## Case

The model is adapted from Stormvogel's published `lion` MDP. The lion can `hunt >:D` or `rawr` while
moving between satisfied, full, hungry, starving, and dead states. State `full` earns reward 100 in
reward model `R`.

The canonical Writ request is:

```text
reward model: R
direction: max
stop state: dead
```

The direct Stormvogel baseline compiles that request to:

```text
R{"R"}max=? [F "dead"]
```

The Writ-to-stormpy adapter instead binds `dead` to the engine label `writ_state_dead`. Storm syntax is
an adapter output, not the Writ request itself.

## Result

The direct Stormvogel baseline and the Writ adapter returned the same scheduler:

```text
satisfied -> hunt
full      -> rawr
hungry    -> hunt
starving  -> hunt
```

Both Storm paths reported:

```text
37732.6318503739
```

The independent checker evaluates the returned scheduler from the exact rational probabilities in
`case.json`, enumerates all 16 stationary deterministic policies, and obtains the exact optimum:

```text
37750
```

The scheduler is exactly optimal for the Writ problem. The Storm number remains recorded separately
as the result of the floating sparse model used by the donor and adapter.

## Altered requests

Changing only the optimization direction to `min` produced a different optimal scheduler and exact
value `0`.

Changing only the Writ stop state from `dead` to `starving` produced the same maximizing actions on
the states where a choice is still needed. The exact optimum is `7750`; Storm reported about
`7749.23504166989`.

Both are valid model-checking results. Neither is an answer to the canonical Writ request because the
semantic query changed.

## Revisions made during execution

The case changed when execution exposed weak assumptions.

Stormvogel 0.12.0 was initially pinned because it contains the lion example. Its converter is
incompatible with Stormpy 1.14.0 for this variable-free model. Stormvogel 0.12.3 keeps the same lion
model and fixes that conversion path, so the baseline moved to 0.12.3 rather than moving Storm
backwards.

The first stopping-condition mutation used the donor display label `starving :((` directly as a Writ
query target. Storm's property parser rejected that literal. The Writ request now names stable state
ID `starving`, and the adapter creates an engine-safe query label. A mathematical target is therefore
bound by state identity rather than display syntax.

The first canonical run also showed that scheduler correctness and engine-reported numeric value need
different guarantees. The checker now verifies scheduler optimality exactly while preserving Storm's
floating result as its own claim.

## What this case earned

Across the first and second mathematical families, the useful shared pattern is now:

```text
model + typed mathematical request
        -> explicit adapter bindings
        -> established engine
        -> typed result
        -> independent check against the original Writ object
```

The case supports stable typed identity, a mathematical request separate from the model, explicit
adapter bindings, numeric-domain metadata, typed results, and an independent-check record as
candidates for Writ's shared layer.

MDP transitions, reward models, temporal stopping semantics, Storm row groups, property strings, and
scheduler representation remain in the probabilistic-model-checking profile.

See `cross-family-findings.md` for the comparison with the influence-diagram family.

## Donors

The execution pins:

- `stormpy==1.14.0` / Storm 1.14.0;
- `stormvogel==0.12.3` for the direct baseline.

Storm and Stormvogel are GPL-3.0 software. They are experiment dependencies, not copied into Writ.
The Writ adapter itself only needs `stormpy`; Stormvogel is used to establish the direct donor
baseline.
