---
name: writ-proving-ground
description: Design and evaluate local proving cases that test whether Writ adds real value beyond the underlying mathematical engine.
---

# Proving ground

Use this skill when choosing a killer case, comparing Writ with a direct-engine baseline, or deciding
whether a proposed abstraction has earned a place in the architecture.

## Role

Choose cases that put the architecture under pressure rather than cases that merely produce a neat
artifact.

A strong proving case should:

- run locally without an LLM or hosted service;
- contain real interacting variables or mathematical structure;
- include uncertainty, competing actions, constraints, or an objective where relevant;
- use an established mathematical engine;
- have a direct-engine baseline using the same substantive inputs; and
- make it possible to tell whether Writ improved inspection, checking, composition, portability, or
  another concrete operation.

The case does not need to be social science.

## Evaluation rule

Do not count extra metadata, more files, or a larger wrapper as success. Writ must make something
important easier to inspect, verify, reuse, or compose without weakening the underlying mathematics.

Test both positive and negative cases. Record unsupported states and cases where the direct engine is
already sufficient.

A failed proving case is useful evidence. Do not rescue an abstraction merely because code for it
already exists.

## Promotion rule

Do not add a general primitive from one convenient example. Promote structure into Writ core only
when the proving work shows that it survives across more than one mathematical family or is clearly
necessary for a bounded typed profile.

## Done when

The result states what Writ added relative to the direct baseline, what it did not add, what failed,
and whether any new core field, adapter rule, checker, or language choice is actually justified.
