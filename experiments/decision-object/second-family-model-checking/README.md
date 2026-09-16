# Second-family proving case: probabilistic model checking

This case tests Writ against probabilistic model checking, a different mathematical family from the
influence-diagram work.

The model is adapted from Stormvogel's published `lion` MDP. The lion moves between satisfied, full,
hungry, starving, and dead states while choosing `hunt` or `rawr`. State `full` earns reward 100.

The Writ request is:

```text
reward model: R
direction: max
stop state: dead
```

Writ keeps that request separate from Storm property syntax. The adapter binds stable Writ state IDs
to engine labels before calling Storm.

## Result

The direct Stormvogel baseline and Writ's normal Storm adapter return the same scheduler:

```text
satisfied -> hunt
full      -> rawr
hungry    -> hunt
starving  -> hunt
```

Their double-precision Storm execution reports about `37732.6318503739`.

The same `case.json` is also compiled to Storm's exact-rational model path. Storm returns exactly:

```text
37750
```

A separate Python checker evaluates the scheduler from the original rational transition probabilities,
enumerates all 16 stationary deterministic policies, and independently obtains the same exact optimum
`37750`.

The numeric-domain distinction is therefore part of the result boundary: the ordinary sparse run is
an approximate engine result, while the exact-rational Storm run and independent checker establish
the exact value.

## Query mutations

Two mutations change only the mathematical request:

- `max` to `min`: exact Storm and the independent checker both return `0`;
- stop at `starving` instead of `dead`: both return `7750`.

The generated exact MDP is byte-identical across these three checks; only the property changes. This
confirms that optimization direction and stopping condition belong to the typed request rather than
the model itself.

## Revisions made during execution

The case was revised when execution exposed weak assumptions.

Stormvogel 0.12.0 was replaced by 0.12.3 because the newer release works with Stormpy 1.14.0 for this
model while preserving the same lion example.

The stopping condition was changed from a donor display label to stable Writ state identity after a
punctuated display label failed as raw Storm property syntax. The adapter now owns engine-safe labels.

The measurable gap in the double-precision result triggered a second audit. Storm's exact-rational
model checker returned the same values as Writ's independent exact checker for the canonical request
and both mutations. That result strengthened the case instead of treating the numeric gap as noise.

## What this case earned

Across the first two mathematical families, the shared pattern is:

```text
model + typed mathematical request
        -> explicit adapter bindings
        -> established engine
        -> typed result with numeric domain
        -> independent check against the original Writ object
```

Stable mathematical identity, typed requests, explicit bindings, engine/version/numeric-domain
metadata, typed results, and check guarantees are candidates for Writ's shared layer.

MDP transition kernels, reward models, temporal properties, schedulers, Storm row groups, and Storm
property syntax remain in the probabilistic-model-checking profile.

See `cross-family-findings.md` for the comparison with the influence-diagram family.

## Run

With Python 3.12:

```sh
python -m pip install 'stormpy[parser]==1.14.0' 'stormvogel==0.12.3'
python direct_baseline.py
python run_writ.py
python run_writ.py --direction min --output min-result.json --source writ-stormpy-min
python run_writ.py --stop-state starving --output stop-result.json --source writ-stormpy-stop
python exact_storm.py
python exact_storm.py --direction min --output exact-storm-min-result.json --source writ-storm-exact-min
python exact_storm.py --stop-state starving --output exact-storm-stop-result.json --source writ-storm-exact-stop
python check.py
```

Storm and Stormvogel are GPL-3.0 experiment dependencies. Their source is not copied into Writ.
