# Cross-family findings

This note compares the first influence-diagram proving family with the probabilistic model-checking
case. It records what has now survived both families and what remains specific to one of them.

## Structure that survived both families

### Stable mathematical identity

Writ needs stable identities for the mathematical objects that a result depends on.

In the influence-diagram case this included node, state, table, and information-set identity. In the
model-checking case it includes state, action, reward-model, and query-target identity.

Display labels and container positions are adapter details. They can be preserved for provenance and
human readability, but they are weak primary identifiers for mathematical bindings.

### The mathematical request is part of the problem

A model alone does not determine the result being claimed.

The influence-diagram case bound an optimization problem and information structure. The model-checking
case makes the request even more visible: the same MDP gives different correct answers when `max`
becomes `min` or when the stopping state changes.

Writ therefore needs a typed request beside the model. Engine syntax is a compilation target for that
request.

### Engine translation is a semantic boundary

A successful engine run establishes a result for the object the engine actually received. Writ still
needs to know whether that object represents the declared problem.

The first family exposed a wrong value-table ordering that remained solvable. The second family
exposed a weaker but similar dependency on engine labels and choice rows. Both cases support explicit
bindings from Writ identity to engine identity.

### Results need claim type and numeric meaning

The first family produced a finite policy whose expected utility could be recomputed exactly. The
second family produced a scheduler and a floating Storm value for an unbounded expected-reward query.

For the canonical lion case, Storm and the Writ adapter both return the same optimal scheduler and
approximately `37732.6318503739`. Exact rational evaluation of that scheduler from `case.json` is
`37750`.

The Writ result therefore needs to distinguish at least:

- the engine-reported numeric result;
- the returned policy or scheduler;
- the independent check performed; and
- the guarantee actually established by that check.

For this case the independent guarantee is exact scheduler optimality for the bounded finite policy
space. It is not an assertion that Storm's floating numeric value is itself exact.

### Independent checks should start from the Writ object

Both families were useful because the checker went back to the original structured problem rather
than merely checking internal consistency of the engine output.

That is the reusable pattern:

```text
Writ problem + typed request
        |              |
        v              v
      adapter ------> engine
        |              |
        +---- result <-+
               |
               v
       independent check
        against Writ problem
```

## Influence-diagram profile

The following concepts are supported by the first family but have not become shared Writ primitives:

- chance, decision, and value nodes;
- conditional probability and utility tables;
- decision information sets;
- limited-memory versus expanded-information semantics;
- influence-diagram policy representation.

They belong in an influence-diagram profile unless another family demonstrates a broader need for the
same exact concept.

## Probabilistic-model-checking profile

The following concepts are specific to the second family so far:

- MDP states and action-labelled choices;
- transition kernels;
- reward models;
- temporal stopping conditions;
- optimization direction over a model-checking property;
- memoryless deterministic schedulers;
- Storm row groups, choice indices, property strings, and synthetic query labels.

The last four Storm construction details remain adapter internals rather than Writ core fields.

## What changed during the case

The experiment was revised when execution exposed two bad assumptions.

First, Stormvogel 0.12.0's converter did not work with Stormpy 1.14.0 for this variable-free model.
Stormvogel 0.12.3 keeps the same lion example and fixes that conversion path, so the donor pin moved to
0.12.3 rather than moving Storm backwards.

Second, the first stopping-condition mutation used the donor display label `starving :((` as the Writ
query target. Storm's property parser rejected that literal. The Writ request now names the stable
state ID `starving`; the adapter binds that state to an engine-safe label.

That revision is important. It is evidence that Writ should preserve mathematical identity and let
adapters own engine syntax.

## Gate result

`SECOND-FAMILY-001` supports promotion work on a small shared decision object, but it does not by
itself define that object.

The evidence now supports examining these candidates for the shared layer:

- stable typed object identity;
- explicit model inputs;
- a typed mathematical request separate from the model;
- explicit adapter bindings;
- engine/version/numeric-domain metadata;
- a typed result;
- an independent-check record and its guarantee.

The next task should decide the smallest version of those concepts that is justified by both proving
families. It should not copy either family's specialized vocabulary into the shared core.
