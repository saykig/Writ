# Writ

Writ is an open protocol for making political knowledge more inspectable, reviewable, and easier for humans to reason from.

Political and institutional work often preserves conclusions better than the path that produced them. Evidence is spread across reports, laws, institutional pages, notes, and other sources. Along the way, it can become difficult to tell what a source directly establishes, what an analyst inferred, what remains uncertain, and why a particular representation was accepted.

Writ keeps those pieces connected:

```text
source → passage → typed record → human review → provenance
```

The goal is not for Writ to reason for the user. The goal is to make the available evidence and human judgment easier to inspect, challenge, verify, and inherit.

## Current proving ground

Writ is currently focused on one narrow problem: representing institutional knowledge about the U.S. National Institute of Standards and Technology (NIST).

A source passage may establish different kinds of institutional facts:

- identity
- placement
- relationship
- mission
- mandate
- function
- decision right
- operational capacity

Writ tests whether these distinctions can be represented precisely without turning evidence for one kind of fact into an unsupported claim about another.

For example, evidence that an institution performs a function does not by itself establish a legal mandate or operational capacity.

## What Writ does

For each record, Writ preserves:

- the source;
- the exact supporting passage;
- the typed claim being made;
- whether the support is direct or inferred;
- explicit uncertainty;
- human review and revision history;
- provenance back to the underlying evidence.

This lets a researcher inspect why a record exists and reach their own conclusions from the underlying material.

## What Writ does not do

Writ is not currently:

- a compliance engine;
- a question or query modeller;
- a policy reasoning engine;
- an AI decision-maker;
- a recommendation system;
- a general-purpose political knowledge graph.

Those are not current product goals.

## Why a language?

Writ currently uses a small domain-specific language to encode source-grounded records and judgments.

That is an implementation hypothesis, not a goal in itself.

The current experiment is whether a small, typed grammar can make institutional knowledge more precise, reviewable, and mechanically checkable than ordinary structured files such as YAML or JSON.

If it cannot, Writ should become simpler.

## Current scope

The NIST institutional corpus is the sole active proving ground.

No additional corpus should be added until the institutional model has demonstrated that it can reliably preserve:

```text
evidence
+ meaning
+ uncertainty
+ human review
+ provenance
```

without overclaiming.

## North star

**Make political knowledge easier to inspect, verify, inherit, and reason from without replacing human judgment.**
