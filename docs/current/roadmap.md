# Roadmap

## North star

Make difficult decision problems explicit enough to inspect, compute with established mathematics,
and check across different mathematical families.

## 1. First proving case — complete

The first bounded workflow uses a limited-memory influence diagram adapted from
DecisionProgramming.jl's Pig Breeding example.

Writ now preserves the declared information sets and table bindings through a thin adapter, compares
the result with a direct DecisionProgramming model, and evaluates the returned policy independently
from the original decision object.

The case exposed a real adapter failure: compatible table shapes allowed value tables to be associated
with the wrong nodes while the donor solver still returned an optimum. Explicit semantic bindings and
the independent checker catch that error.

## 2. Independent engine check — complete

The same decision object has also been executed through pyAgrum 3.0.0 using Shafer-Shenoy LIMID
inference.

DecisionProgramming/JuMP/HiGHS and pyAgrum use different computational implementations and return the
same policy and checked expected utility for the case.

This establishes an influence-diagram profile and several adapter invariants. It also separates
portable problem meaning from engine-specific model construction and solver settings.

## 3. Test a different mathematical family — current gate

Choose a bounded problem whose natural mathematics differs from influence diagrams. Reuse only the
small shared envelope already earned: explicit identities, typed mathematical relationships, exact
bindings, engine identity, returned result, and an independent check where one is available.

Good candidates include robust or stochastic optimization, probabilistic model checking, or another
established decision formalism with a clear direct-engine baseline.

**Exit gate:** the case identifies which structure remains useful across mathematical families and
which structure belongs in a typed profile.

## 4. Promote the smallest shared decision object

Promote fields into Writ core after the cross-family proving work supports them.

Keep specialized probability models, utility structures, solver options, proof objects, and other
engine semantics in typed profiles.

**Exit gate:** the shared object contains only structure supported by the proving cases, with exact
translation boundaries and clear unsupported states.

## 5. Strengthen the trust boundary when the cases earn it

TypeScript remains useful for the application and interchange layer. Mathematical engines stay in
their native ecosystems.

A small Rust checker becomes useful when several result types share the same portable exact-checking
need. Lean becomes useful when stable theorem or checker properties become repeated dependencies.
Julia, Python, R, C++, and other languages can own mathematical work when their existing ecosystems
already provide the right machinery.

## 6. Apply the substrate to harder domains

After the shared object and local proving cases are strong, test domains where decisions are harder
to repeat and harder to formalize: scientific operations, infrastructure, AI governance, and later
security and global affairs.

Domain-specific concepts enter through typed profiles and supplied models. The shared core remains
focused on decision structure that transfers across domains.
