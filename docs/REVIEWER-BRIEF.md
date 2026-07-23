# Reviewer brief: the Gap Matrix, through Writ

For **Sara** (or any Gap Matrix author). This asks you to check one thing: does
Writ represent your methodology faithfully, and does its analyzer point at
the right places? It takes about fifteen minutes and needs no code.

## What Writ did with your Gap Matrix

It compiled your `frontier-ai-governance` field into a program (two axes, five
weighted components each, five-anchor ordinal rubrics), encoded your current
component assessments as reviewed evidence, and recomputed the result with a
deterministic evaluator. Nothing about the numbers is invented — it re-runs your
`round(100·Σ wᵢ·sᵢ/4)` over your levels.

- See it: **writ-dsl.vercel.app/gap-matrix**
- The methodology: `examples/ai-governance-gap-matrix.writ`
- The reproduction test: `packages/benchmark/test/gap-matrix-reproduction.test.ts`

## What to confirm or reject

Please answer each **yes / no / "not quite"**. "Not quite" is the most useful
answer — it tells us where the encoding is wrong.

1. **The indices.** Writ computes **public authority = 50** (all five
   components at level 2) and **knowledge concentration = pending** (two of five
   components unassessed). Do these match what your engine produces for the same
   levels?

2. **Pending, not zero.** Knowledge concentration is `pending` because
   critical-resource-control and expertise-concentration are unassessed — the
   index is null, never 0. Is that the behaviour you intend?

3. **Pending-decisiveness.** The analyzer reports each axis *pending-decisive*:
   the index depends on every component, so any one unresolved component holds the
   whole axis pending. It names the two that do. Is that a correct and useful
   statement about where your assessment is currently fragile — or is it obvious
   to the point of noise?

4. **The public gate — a known divergence, please rule on it.** Your engine gates
   a *public* score on every component being `reviewed`/`published`; your current
   components are `provisional`, so your public scores are null for **both** axes.
   Writ currently gates only on *pending*, so it would publish public
   authority = 50 where you would hold it null pending review. **Which gate is
   right?** If yours, we should tighten Writ to your assessment-status gate.

5. **The encoding.** Writ treats each analyst assessment as a reviewed
   evidence claim carrying the ordinal level, and the rubric anchors select on it.
   Your model treats the ordinal judgment as the primary datum, so this seemed
   faithful — but does encoding the level as "evidence" lose anything that
   matters (e.g. the distinction between the level and the evidence behind it)?

6. **What it does not yet check.** Because your anchors are prose conditions over
   evidence (not a declared numeric level), the analyzer does **not** statically
   verify that your five anchors are exhaustive and mutually exclusive per
   component. Is that a gap worth closing, or is anchor well-formedness something
   you already guarantee by construction?

## What your review does and does not establish

- It **does** tell us whether Writ represents your methodology faithfully and
  whether the analyzer's findings are correct and useful. That is the one external
  validation the pilot is missing.
- It **does not** validate the scores themselves. Those are your judgment;
  Writ only recomputes and audits them. A "yes" here means "the tool is
  honest about my method," not "the method is right."

Any single "not quite" is a concrete improvement for us to make — that is the
point of asking.
