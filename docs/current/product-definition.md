# Current product definition

Writ is infrastructure for making consequential decision-making more **inspectable, cumulative, and
correctable** while keeping evidence, mathematics, interpretation, and human authority distinct.

Its long-term objective is not to formalize all political judgment or to produce one universal
decision calculus. It is to preserve enough structure that a later human or machine can determine
what was known, what was assumed, what followed mathematically, what remained uncertain, what was
decided, and what changed afterward.

## Current architecture

Writ currently has two separate layers.

### 1. Source-grounded knowledge

```text
source
-> passage
-> typed record
-> human review
-> provenance
```

This layer preserves institutional and legal-policy knowledge without making downstream analyses or
questions the source of truth for those records. NIST remains its active institutional proving
ground.

### 2. Derived decision cases

```text
explicit question / requested operation
+ supplied content and modelling assumptions
+ exact mathematical problem/query bytes
-> candidate execution
-> independent mathematical check
-> applicability
-> human disposition
-> revision / reuse
```

This layer is separate from native records. It can preserve an explicit question because a
mathematical guarantee is meaningless without its query, model, assumptions, information context,
units, and permitted operation. It does not turn that question or answer into a source fact.

The first implementation is the bounded `derived_decision_case` package merged in PR #43. It uses a
pinned Decision Lab checker for `finite-linear-uncertainty.v1`. ADR 0026 still records that
architecture as **Proposed** until its status is explicitly resolved; merged implementation is not
itself evidence that every future decision capability should use the same adapter or shape.

## Bellman and Writ

Bellman develops and assembles the mathematical foundations for consequential decision-making:
objects, assumptions, operations, guarantees, composition rules, failure boundaries, and
provenance. Writ turns stable portions of those semantics into executable, versioned infrastructure.

The intended relationship is:

```text
Bellman mathematics
-> executable producer / solver where useful
-> independently checkable certificate or result
-> Writ binding, versioning, applicability, reuse and correction
```

Engineering does not determine the mathematics, and today's Python/TypeScript implementation does
not define tomorrow's mathematical ceiling.

## Governing separations

Writ must keep separate:

- source evidence from interpretation;
- source support from a modelling choice;
- one exact model from a set or outer enclosure of models;
- mathematical correctness from empirical model adequacy;
- a checked result from applicability to a revised case;
- a common optimal action from a complete pointwise minimizing set;
- uncertainty or nonidentification from exact ties;
- human review from mathematical checking;
- recommendation or optimality from institutional authority to act.

Historical results remain valid under the premises they actually had. Revisions should suspend,
narrow, transport, tighten, or replace current reuse with explicit justification rather than erase
the old result.

## Current proving grounds

- **NIST institutional corpus:** source grounding, typed institutional facts, review, provenance,
  supersession, and source/version integrity.
- **Synthetic derived decision cases:** exact mathematical binding, checking, revision, applicability,
  and portable handoff. These cases are tests of infrastructure, not product ontologies or empirical
  claims about the world.

Other reviewed corpora remain preserved and inspectable. They do not have to drive current
development merely because they exist.

## Current non-goals

Writ is not presently:

- an autonomous policy decision-maker;
- a general recommendation or question-answering system;
- a universal political ontology or knowledge graph;
- a general scenario or game-theory engine;
- an empirical probability estimator that invents priors or source reliabilities;
- a system that infers causal effects from provenance;
- an authority or approval system that turns mathematical optimality into permission to act.

Future causal, sequential, strategic, robust, or information-acquisition capabilities should enter
only when Bellman supplies the relevant semantics and a bounded Writ integration demonstrates the
need.

## Direction

The current sequencing and exit gates live in [`roadmap.md`](./roadmap.md). The roadmap may evolve
as evidence accumulates. Accepted ADRs and schemas remain the authority for durable contracts.
