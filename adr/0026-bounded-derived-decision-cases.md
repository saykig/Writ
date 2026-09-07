# ADR 0026: Add bounded derived decision cases through a pinned checker boundary

**Status:** Proposed

## Context

ADRs 0021 and 0022 correctly removed questions and compliance execution from the political-knowledge
record boundary. The NIST institutional corpus remains the sole active knowledge proving ground.
The present integration case demonstrates a narrower need that records alone cannot meet: a
recipient should be able to reopen one explicit mathematical subject, distinguish supplied content
from modelling choices, execute a supported calculation, revise an input, and learn which old
guarantee no longer transfers.

Bellman's accepted mathematical artifacts specify conditional finite joint-law, identification and
decision meanings. Decision Lab Build 2 exposes `finite-linear-uncertainty.v1` through an untrusted
candidate producer and an independent exact checker. Neither external repository is owned or
modified by Writ, and neither computation supplies empirical truth, human approval, or authority to
act.

This ADR is intentionally proposed, not accepted. The implementation on its review branch is a
candidate for human architectural disposition.

## Options considered

### 1. Bare case or notebook files

A direct script can carry the exact problem/query files, call the same producer and checker, and
obtain the same mathematical answers with less Writ-owned code. This remains the clearest baseline.
It does not by itself standardize source spans, source-to-model mappings, revision impact,
applicability, human disposition, portable handoff, or refusal of a mismatched intended use. A
competent operator can add each safeguard directly; Writ must not claim stronger mathematics merely
for packaging them.

### 2. Writ-owned derived package with one thin pinned adapter

Writ owns a small versioned case and execution envelope, exact source-span and dependency checks,
revision comparison, an explicit runner, and a fresh-checking consumer. Backend problem, query and
candidate bytes remain losslessly encoded and byte-hashed. A fixed adapter calls the exact pinned
Decision Lab library interface; case data cannot name a command. This adds one bounded interface
without making analyses into records or copying the optimizer/checker into Writ.

### 3. Larger general decision workspace

A workspace could add multiple engines, notebooks, registries, dashboards, databases, general
belief revision and broad composition. The first case supplies no measured need for those surfaces.
They would enlarge the semantic and maintenance boundary before another operation earned it.

## Proposed decision

Select option 2 for review.

Add a separate `derived_decision_case` namespace governed by the analysis-layer schemas. It is not a
Core or family record, does not enter the corpus catalog, and does not affect NIST data or identities.
Its first and only adapter supports the exact Decision Lab commit
`7215b53096bc487756f94f4ca87390716a14f2ee`, semantics
`finite-linear-uncertainty.v1`, and the bounded `decision` and `compatibility` operations used by the
fixture.

The pure layer verifies the portable envelope, exact bytes, Writ source/version/reference identity,
actual cited byte spans, complete model-row/loss mappings, and an acyclic derivation dependency
graph. Derivation edges never imply statistical independence or causality. Writ's historical
canonical JSON profile is unchanged; raw mathematical bytes and identifiers are not passed through
its number or Unicode normalization rules.

Only the explicitly invoked runner owns process execution. It verifies the complete
repository-owned Python import closure used by the pinned adapter, starts the fixed bridge in Python
isolated mode, and verifies the declared CPython implementation and major/minor before inserting the
verified source path. It obtains an untrusted candidate through the upstream producer and invokes the
upstream exact checker separately against independently supplied intended bytes. A recipient invokes
the checker again after reload. The interpreter, standard library, OS and installed SciPy
distribution remain trusted prerequisites; this boundary does not claim to sandbox an arbitrary
trusted executable. Missing backends, pin drift, malformed candidates, absent/invalid certificates,
unsupported semantics or operations, stale subjects, and unsupported uses fail closed. An upstream
`unresolved` stays non-functional and is not translated into incompatibility or model dependence.

Every execution keeps three meanings separate:

1. exact mathematical check status for the selected problem/query bytes;
2. applicability of the evidence-to-model mapping for the selected case revision;
3. human disposition, with no fabricated reviewer or acceptance.

A source-only change may preserve the mathematical bytes and old exact theorem while still marking
applicability for reassessment. A changed problem, loss or query requires a new exact check. Prior
case revisions and execution artifacts remain immutable snapshots.

## Consequences and limits

- Corpora, records, sources, passages and reviews remain independent of decision questions.
- NIST remains the sole active knowledge proving ground; the first case is explicitly synthetic.
- The adapter is replaceable at the envelope boundary, but this ADR does not create a plugin
  registry or second backend.
- No independence, midpoint probability, model weighting, minimax policy, causal effect,
  conditional update, sequential policy, safety guarantee or authority to act is inferred.
- A common optimal-action set is reported with the upstream meaning; it is not promoted to a
  complete pointwise minimizing set unless the checker supplies that status.
- Outer-enclosure compatibility retains the upstream qualification and is never promoted to
  original compatibility.
- The direct script remains equally mathematically adequate when it performs the same fresh exact
  checks. The Writ layer earns only the explicit portable provenance and revision safeguards observed
  in this case, not a productivity or adoption claim.
- Any additional semantics, engine, corpus coupling or human-acceptance automation requires another
  bounded decision and tests.
