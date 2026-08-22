# What the analyzer decides — and what it does not

This page documents the retained `packages/analyzer` runtime while dependency isolation is pending.
The analyzer is not part of Writ's current source-to-provenance product boundary, and this document
does not establish a query or analysis layer as active architecture.

Writ's static analyzer inspects a *methodology* before any evidence exists.
This document states, honestly, what a finding means, what a clean result
guarantees, and where the analysis is silent. Being explicit about the bounds is
the point: a tool that overstates what it proves is worse than one that says "I
cannot decide this here."

## What it decides

**Score programs** (the `+1/0/-1` shape), over the finite domains a methodology
declares with `assert … over var in …`:

- `WRT-SCORE-GAP` — some input state matches no rule and `otherwise` does not
  resolve it (an uncovered region), with a minimal witness.
- `WRT-SCORE-OVERLAP` — two equal-priority rules match with different results and
  are not marked `intentional_overlap`.
- `WRT-SCORE-UNREACHABLE` — a rule is satisfiable by no input in the declared
  domain.
- `WRT-SCORE-MONOTONICITY` — a declared `monotonic` axis is violated by a witness
  pair.

**Measures** (the weighted-ordinal shape), over the same declared domains:

- `WRT-MEASURE-WEIGHTS` — component weights are negative or do not sum to 1.
- `WRT-MEASURE-ANCHOR-GAP` / `WRT-MEASURE-ANCHOR-OVERLAP` — a component's ordinal
  anchors leave some state uncovered, or two anchors match one state with
  different levels. Checked only when the anchors reference variables with a
  declared domain (see below).
- `WRT-MEASURE-PENDING-DECISIVE` (info) — the index is pending unless *every*
  component resolves; any one pending component blocks it. This is the graded
  analog of interpretation-sensitivity: it localizes where a single unresolved
  judgment carries the whole result.

## The method

Bounded enumeration over the declared finite product is the oracle and the path
the CLI runs. For score programs, a Z3 SMT lowering exists and is held
**byte-identical** to enumeration on seeded fixtures (`cross-check.test.ts`); it
is the intended scale path for domains too large to enumerate, but is not yet
wired into the CLI, and there is no Z3 path for measures yet.

## Where it is silent (by design)

- **Bounded.** Guarantees hold only inside the declared `min..max`/`{set}`
  domains. A gap at a value outside the declared range is invisible; declaring
  `strong_count in 0..8` says nothing about 9+.
- **No domains, weaker claim.** With no `assert … over …`, the score program's
  input space is not enumerated. For a **measure** whose anchors reference a
  declared-domain variable, the analyzer enumerates and checks the anchor
  *conditions* (do they partition every state?). For a measure whose anchors are
  evidence queries with no such variable, it cannot reason
  about the conditions, but it still runs a **structural level check**: every
  ordinal level `0..scale` must be declared exactly once, so a missing or
  duplicated anchor level is caught (`WRT-MEASURE-ANCHOR-GAP`/`OVERLAP`). What it
  does *not* verify for query-driven anchors is that the conditions themselves are
  mutually exclusive and exhaustive.
- **Uncertainty under-decision.** A rule or anchor whose guard is `unknown`
  (a query, an unimplemented call, a reference outside the domain) is neither
  decisively true nor false, so a region covered only by an uncertain rule is not
  reported as a gap — even though it resolves to `unresolved`/pending at run time.
  The analyzer under-reports here rather than guess.
- **`GAP` is gated on `otherwise unresolved`.** A concrete `otherwise 0`/`-1` is
  treated as a total catch-all, so it suppresses gap findings by construction.
- **Judgment is out of scope.** The analyzer checks the *shape* of a rubric, not
  whether a classification or an anchor level is the right call. That judgment is
  what the interpretation profiles make explicit and the evidence ledger records.

## Clean results are results

An empty finding set over declared domains is a positive statement: *this rubric
has no gap, no overlap, and well-formed weights, within the declared domain.* The
2025 AI-for-SMEs resolved methodology analyzes clean; the Writ-owned synthetic
weighted-ordinal fixture reports well-formed weights and localizes
pending-decisiveness. A
tool that only ever "finds problems" is not trustworthy; reporting "clean, and
here is exactly what that covers" is.
