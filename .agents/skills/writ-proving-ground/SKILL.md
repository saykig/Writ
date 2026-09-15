---
name: writ-proving-ground
description: Design and evaluate local proving cases against a direct mathematical-engine baseline.
---

# Proving ground

Use this skill when choosing a killer case, comparing Writ with a direct-engine baseline, or deciding
whether a proposed abstraction has earned a place in the architecture.

## Role

Choose cases that put the architecture under pressure and expose the value of the decision object,
adapter boundary, and checking path.

A strong proving case should:

- run locally from structured inputs;
- contain interacting variables or meaningful mathematical structure;
- include uncertainty, competing actions, constraints, or an objective where relevant;
- use an established mathematical engine;
- have a direct-engine baseline using the same substantive inputs; and
- measure whether Writ improves inspection, checking, composition, portability, or another concrete
  operation.

The proving case can come from any domain.

## Evaluation rule

Count concrete workflow improvements as success. Compare the Writ path with the direct-engine path
using the same problem and substantive inputs.

Test positive and negative cases. Record unsupported states and cases where the direct engine is
already sufficient.

A failed proving case is useful evidence and can remove an abstraction from the roadmap.

## Promotion rule

Promote structure into Writ core after proving work shows that it transfers across more than one
mathematical family or is necessary for a bounded typed profile.

## Done when

The result states what Writ added relative to the direct baseline, where the direct engine remained
sufficient, what failed, and which core fields, adapter rules, checkers, or language choices have
actually earned further investment.
