# Writ

Writ is an open protocol for making consequential institutional knowledge inspectable, reviewable, and provenance-preserving.

Political and institutional decisions are usually easier to observe than the fragmented evidence, judgments, uncertainty, authority, and constraints that produced them. Writ is building the substrate needed to preserve those pieces without replacing human judgment.

## Current system

Writ's present boundary is deliberately narrow:

```text
source
→ passage
→ typed record
→ human review
→ provenance
```

The system is designed around several principles:

- evidence and interpretation remain distinguishable;
- unknown does not silently become false;
- inferred support is not treated as direct support;
- different kinds of institutional facts remain distinct;
- accepted material is superseded rather than silently rewritten;
- provenance is deterministic over frozen inputs;
- human review controls acceptance.

Writ also contains a small portable mechanical provenance kernel and bounded internal grounding tools for cases where evidence can be reproducibly derived from frozen structured sources.

## What Writ is not

Writ is not currently:

- a policy reasoning engine;
- a recommendation system;
- an AI decision-maker;
- a compliance engine;
- a scenario simulator;
- a question-answering system;
- a general-purpose political knowledge graph.

Questions, analyses, models, and conclusions may use Writ records, but they are not the source of truth for those records.

## Research direction

The longer-term research question is whether this substrate can support **decision provenance**.

Given a consequential decision that happened, could a reviewer reconstruct the smallest defensible chain showing:

```text
evidence / intelligence
→ uncertainty and competing interpretations
→ institutional authority and constraints
→ decision
→ material implementation
→ observed consequences
```

without turning government claims into facts, analyst interpretations into evidence, temporal sequence into causation, or missing information into invented certainty?

That capability does not exist in Writ yet.

Current research stress cases are used to discover which additional primitives are genuinely necessary. They do not automatically become canonical corpora or production features. New capabilities must earn their way into the core through demonstrated need.

**Writ should make it harder for consequential reasoning to lose its provenance.**

Copyright 2026 Sara Kim
