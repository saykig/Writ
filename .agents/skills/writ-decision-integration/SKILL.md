---
name: writ-decision-integration
description: Transfer mature Bellman decision semantics into Writ through exact, independently checkable, revision-aware interfaces.
---

# Writ decision integration

Use this skill for Bellman-to-Writ transfer, Decision Lab integration, mathematical decision cases,
candidate execution and checking, sequential or model-family certificates, certificate transport
or accumulation, and mathematical revision, reuse, or applicability. Read `writ-domain` for the
meanings of Writ objects and states.

## Transfer contract

Bellman supplies the mathematical objects, premises, operations, composition rules, and guarantees.
Writ does not invent missing mathematics or weaken a premise at the interface. For each mature
primitive:

1. encode the exact mathematical subject;
2. preserve every assumption and dependency required by its guarantee;
3. compute or receive a candidate through an explicit producer boundary;
4. independently check only the supported mathematical claim;
5. bind the subject, candidate, certificate, and result to exact bytes and identities;
6. assess empirical applicability separately;
7. preserve human disposition separately; and
8. version, revise, transport, tighten, or reuse without rewriting history.

Keep mathematical truth or semantic guarantee, producer execution, checker assurance, empirical
or model adequacy, applicability, human disposition, and authority to act as distinct claims. A
checked result establishes neither empirical truth nor permission to act.

## Exact binding

Bind a checked result to every dimension on which the guarantee depends, including where relevant:

- model/problem identity and requested operation;
- action or policy class and information access;
- horizon and history structure;
- exact units and representations;
- assumptions and loss/cost semantics;
- uncertainty or model-family semantics;
- guarantee and certificate type;
- source and model dependency identities; and
- exact candidate and certificate bytes.

A caller may supply premises but may not silently omit or weaken Bellman premises. Treat Python and
TypeScript as current reference implementations rather than the mathematical architecture.

## Production and assurance

Keep candidate production and checking separable. Where the certificate type supports portable
checking, preserve enough bytes for a recipient to run a fresh check. Replaying the same unchecked
calculation does not establish independent assurance. Document the trusted computing boundary,
including parsing, canonicalization, arithmetic, checker code, and any external runner it trusts.

Fail closed on unsupported semantics, identity mismatch, malformed bytes, stale subjects, and
missing premises. Data must never select arbitrary executable commands.

## Revision and composition

Preserve old mathematical results, dependency changes, applicability reassessments, and successor
subjects/results. A changed world, source basis, model, mapping, unit, assumption, or intended use
may leave the old mathematics correct while making the result inapplicable; do not mutate it.

Keep these states distinct when the primitive uses them:

- compatible, incompatible, and unresolved/not established;
- identified and nonidentified;
- exact tie and uncertified action.

Persistent model-family uncertainty must not silently become node-by-node model switching. Before
composing outputs, establish that the component guarantees permit that exact composition. Shared
labels, a common decision, overlapping intervals, individually valid certificates, or local policy
agreement do not establish composability.

## Implementation threshold

Do not migrate languages automatically. Re-evaluate the implementation only at a demonstrated
bottleneck:

- if handwritten Python search or optimization is the bottleneck, evaluate Julia with established
  optimization tooling on an existing problem;
- if several Bellman certificate types need a durable independent infrastructure checker, evaluate
  Rust with exact rational arithmetic;
- if a stable foundational theorem becomes a dependency for many later guarantees, consider Lean.

Do not introduce a universal solver registry, generic graph architecture, ontology,
service/database layer, implicit output composition, authority-to-act semantics, or new Bellman
mathematics as part of a transfer.

## Required evidence

For each transferred primitive, add decisive fail-closed tests for:

- a valid positive case;
- malformed and stale/mismatched subjects;
- a missing premise;
- a forged or altered certificate;
- unsupported semantics;
- revision or applicability failure; and
- recipient fresh checking where the certificate type supports it.

Report separately what producer execution demonstrated, what the independent checker established,
what remains in the trusted computing boundary, and what applicability or human review still must
decide.
