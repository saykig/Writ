# Design principles

These are the main lessons Writ should carry into new work.

They are not a frozen architecture. A later proving case can change them, but new work should not
quietly violate them. If a principle needs to change, record the reason and the evidence that made
the change necessary.

## 1. Make the decision problem explicit before choosing the tool

Start with what is being decided: the variables, uncertainty, information, actions, constraints, and
objective that actually matter. Do not begin with a preferred solver or language and force the
problem into it.

## 2. Keep different kinds of claims separate

Do not blur supplied information, modelling assumptions, mathematical results, independent checks,
real-world applicability, and human decisions. Success at one layer does not establish the others.

## 3. Preserve the mathematics you borrow

Different mathematical systems mean different things. A probability distribution, uncertainty set,
causal relation, information edge, constraint, and data dependency are not interchangeable. Writ
should preserve the native meaning of the engine it uses rather than flattening everything into one
universal representation.

## 4. Reuse established mathematics before building new mathematics

Prefer mature local libraries and solvers when they already implement the needed mathematics. Writ
should own the decision object, adapter boundary, exact bindings, and checks, not rebuild a general
solver ecosystem.

## 5. The correctness path must work locally

A proving case must run without an LLM or hosted service. Models may later help author or inspect a
decision object, but they are not part of the correctness boundary.

## 6. Be exact at boundaries

Preserve the versions, units, identities, inputs, outputs, and numeric representation that a result
depends on. Do not silently round, normalize, substitute, or reinterpret values when doing so can
change the mathematical claim.

## 7. Check independently when a useful check is possible

An engine may produce a candidate result. Writ should verify that result separately when there is a
meaningful independent check. A saved success flag is evidence that a check happened before; it is
not permanent authority.

## 8. Never fill in missing substance for convenience

Do not invent probabilities, utilities, causal effects, constraints, authority, missing states, or
other model structure just to make a calculation possible. Unsupported information should remain
unsupported or unknown.

## 9. Treat change carefully

A changed input does not automatically make an old calculation mathematically wrong. Distinguish
between:

- an old result that is still correct for its original problem;
- a changed mathematical problem that needs recomputation; and
- a result that may still be mathematically correct but needs a new real-world applicability
  judgment.

Build change-tracking machinery only when a real proving case needs it.

## 10. Do not turn sequence into causation or analysis into authority

A later Writ object may trace `decision -> implementation -> observed outcome -> reconsideration`.
That sequence is useful provenance, but it does not prove that the decision caused the outcome. In
the same way, a mathematical recommendation or ranking does not authorize a human or institution to
act.

## How to use these principles

Use them as a filter for new schemas, adapters, proving cases, and language choices. New primitives
should be added only when a concrete case needs them. If a future case genuinely conflicts with a
principle, update the principle openly rather than working around it in code.
