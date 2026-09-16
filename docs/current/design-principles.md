# Design principles

These principles capture the main lessons Writ carries into new work.

They guide the current architecture while remaining open to revision when a proving case provides
clear evidence for a better rule.

## 1. Define the decision problem before choosing the tool

Begin with the variables, uncertainty, information, actions, constraints, and objective that define
the problem. Choose the solver or language after that structure is clear.

## 2. Keep different kinds of claims separate

Record supplied information, modelling assumptions, mathematical results, independent checks,
real-world applicability, and human decisions as distinct claims. Each layer supports its own kind of
conclusion.

## 3. Preserve donor mathematics

Carry the native meaning of each mathematical system through the adapter boundary. Probability
distributions, uncertainty sets, causal relations, information links, constraints, and data
dependencies keep their own semantics.

## 4. Reuse established mathematics

Use mature local libraries and solvers when they already implement the mathematics well. Writ focuses
on the decision object, adapter boundary, exact bindings, and checks.

## 5. Keep the correctness path local

A proving case runs locally from structured inputs through engine execution and checking. This keeps
the mathematical path reproducible and inspectable.

## 6. Preserve exact semantic bindings

Record the versions, units, identities, inputs, outputs, and numeric representations that a result
depends on. Bind tables, axes, states, variables, nodes, and relationships by explicit identity and
type. Container order is an implementation detail rather than the sole carrier of mathematical
meaning. Preserve exact values wherever the mathematics requires them.

## 7. Check independently when useful

Treat engine output as a candidate result when an independent check is available. Bind the check to
the original problem, assumptions, units, action set, objective, and information structure.

## 8. Represent missing substance explicitly

Keep unknown values, unsupported states, absent probabilities, and unresolved model structure
explicit. Missing information remains visible in the decision object.

## 9. Type the effect of change

When an input changes, classify what changed: the recorded situation, the mathematical problem, the
applicability judgment, or some combination of them. Recompute only when the mathematical claim
requires it.

## 10. Separate chronology, causation, and authority

A future decision trace may record:

```text
decision -> implementation -> observed outcome -> reconsideration
```

Chronology records what happened. Causal claims require their own support. Human or institutional
authority remains a separate part of the decision record.

## How to use these principles

Use these principles to evaluate new schemas, adapters, proving cases, and language choices. Promote
new primitives when a concrete case shows that they are necessary and reusable. Record any future
revision to a principle together with the evidence that motivated it.
