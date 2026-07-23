# What the analyzer decides — and what it does not

Covenant's static analyzer inspects a *methodology* before any evidence exists.
This document states, honestly, what a finding means, what a clean result
guarantees, and where the analysis is silent. Being explicit about the bounds is
the point: a tool that overstates what it proves is worse than one that says "I
cannot decide this here."

## What it decides

**Score programs** (the `+1/0/-1` shape), over the finite domains a methodology
declares with `assert … over var in …`:

- `COV-SCORE-GAP` — some input state matches no rule and `otherwise` does not
  resolve it (an uncovered region), with a minimal witness.
- `COV-SCORE-OVERLAP` — two equal-priority rules match with different results and
  are not marked `intentional_overlap`.
- `COV-SCORE-UNREACHABLE` — a rule is satisfiable by no input in the declared
  domain.
- `COV-SCORE-MONOTONICITY` — a declared `monotonic` axis is violated by a witness
  pair.

**Measures** (the weighted-ordinal shape), over the same declared domains:

- `COV-MEASURE-WEIGHTS` — component weights are negative or do not sum to 1.
- `COV-MEASURE-ANCHOR-GAP` / `COV-MEASURE-ANCHOR-OVERLAP` — a component's ordinal
  anchors leave some state uncovered, or two anchors match one state with
  different levels. Checked only when the anchors reference variables with a
  declared domain (see below).
- `COV-MEASURE-PENDING-DECISIVE` (info) — the index is pending unless *every*
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
- **No domains, no claim.** With no `assert … over …` (and, for a measure, no
  declared domain on the variables its anchors read), nothing is enumerated and
  nothing is asserted. Anchor coverage of query-driven rubrics (e.g. the ported
  Gap Matrix, whose anchors read evidence claims) is therefore *not* claimed; the
  weight and pending-decisive findings still apply.
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
2025 AI-for-SMEs resolved methodology analyzes clean; the ported Gap Matrix
reports well-formed weights and localizes pending-decisiveness on both axes. A
tool that only ever "finds problems" is not trustworthy; reporting "clean, and
here is exactly what that covers" is.
