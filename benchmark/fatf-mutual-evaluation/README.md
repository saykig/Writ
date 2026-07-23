# FATF Mutual Evaluations — the third methodology (scaffold, source-gated)

This corpus ports the **Financial Action Task Force (FATF) Mutual Evaluation**
ratings into Covenant, as the project's third methodology. Its purpose is to move
the generality claim from "two methodologies" toward a pattern, on a record
Covenant's authors had **no hand in writing**: a standing intergovernmental body
publishes the ratings in full, per country, in the
[Consolidated Assessment Ratings table](https://www.fatf-gafi.org/en/publications/mutualevaluations/documents/assessment-ratings.html).

It exercises the **discrete three-point score path** (the same shape as the 2025
AI-for-SMEs benchmark), not the graded-measure path — see the Gap Matrix corpus
for that one.

## What it measures

FATF rates each assessed country on two axes:

- **Technical compliance** — each of the **40 Recommendations** is rated
  Compliant (C) / Largely Compliant (LC) / Partially Compliant (PC) /
  Non-Compliant (NC), with Not Applicable where a Recommendation does not apply.
- **Effectiveness** — each of the **11 Immediate Outcomes** is rated
  High / Substantial / Moderate / Low.

Covenant does not re-derive these ratings (they are the input evidence). It
reproduces the **derived, published outcome** FATF computes from them: the
country's **follow-up stream** — regular or enhanced — assigned at the adoption
of its Mutual Evaluation Report. In the receipt's three-point vocabulary,
**+1 = regular follow-up** (an adequate system) and **-1 = enhanced follow-up**
(deficiencies trigger heightened scrutiny).

## Encoding

- The methodology of record is
  [`examples/fatf-mutual-evaluation.covenant`](../../examples/fatf-mutual-evaluation.covenant).
  Each rating is one reviewed, accepted evidence claim:
  `claim_type` `"technical_compliance"` with `subject_ref` `"R.<n>"` and `object`
  in `{C, LC, PC, NC, NA}`, or `claim_type` `"effectiveness"` with `subject_ref`
  `"IO.<n>"` and `object` in `{High, Substantial, Moderate, Low}`.
- The follow-up rule counts PC/NC Recommendations and Low/Moderate outcomes and
  places the country in enhanced follow-up on any documented trigger; the two
  branches are exact negations, so the analyzer statically verifies they
  **partition** the rating space (no gap, no overlap).
- The **soft quantifier** this methodology is meant to surface is the
  **"largely" vs "partially" compliant** boundary — a documented analyst
  judgment. The planned interpretation profile re-reads one borderline `LC` as
  `PC`, moving the PC/NC count across the threshold, to show whether that single
  reading flips the follow-up stream — the FATF analog of the AI-for-SMEs
  Japan/US `0 → +1` sensitivity.

## What is still source-gated

This is a **scaffold**. The encoding, the static analysis, and the rule's
computation over evidence are done and tested
(`packages/benchmark/test/fatf-reproduction.test.ts`, over *synthetic,
clearly-labelled* ratings — no real country's ratings appear anywhere yet). Three
things must be sourced from the primary record before any reproduction is
claimed:

1. **The enhanced-follow-up trigger constants.** The thresholds in the
   methodology (8 PC/NC; 9 Low/Moderate outcomes; 6 Low outcomes) and the core
   Recommendation set (R.3, R.5, R.6, R.10, R.11, R.20) are transcribed from
   recollection of the *Procedures for the FATF Fourth Round of AML/CFT Mutual
   Evaluations* and must be verified against that document verbatim.
2. **The per-country ratings** — the 40 + 11 published ratings per country, from
   the Consolidated Assessment Ratings table, transcribed into one snapshot per
   country (see `ratings.template.json` for the exact shape).
3. **The assigned follow-up streams** — FATF's actually-assigned regular/enhanced
   stream per country, the record the reproduction is checked against. Where
   Covenant's mechanical computation diverges from FATF's assignment, that
   divergence localizes plenary discretion — a finding, not a bug.

Until then, `packages/benchmark/test/fatf-reproduction.test.ts` holds the real
reproduction as a pending `test.todo`.
