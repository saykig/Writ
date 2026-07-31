# Candidate third methodologies

**Archived planning snapshot.** This document is historical and non-normative. Its selected FATF
scaffold now lives under `benchmarks/evaluator/`; the other candidates are not active work.

The pilot has one historical source-backed score reproduction (G7 AI-for-SMEs,
three-point), while weighted-ordinal behavior is covered by a Writ-owned
synthetic fixture. A future independent methodology should test whether the
encoding generalizes beyond those development fixtures.

## What makes a good candidate

1. **Published per-unit scores** (per country / jurisdiction / party) we can
   reproduce and check against a record we did not produce.
2. **A soft quantifier or scope term** in the rubric — "adequate", "substantial",
   "sufficient", "largely", "as appropriate", "up to N" — the place a score turns
   on a reading, which is the phenomenon Writ exists to surface.
3. **Independent authorship** — not ours, ideally a standing institution.
4. **Tractable to encode** — a bounded rubric and reachable evidence.

## Shortlist

Each notes the phrase it would stress and which Writ capability it exercises
(the three-point gap/overlap path, or the graded-measure path).

### 1. FATF Mutual Evaluations (AML/CFT) — _chosen; scaffold landed, source-gated_

- **What:** the Financial Action Task Force rates each country **Compliant /
  Largely Compliant / Partially Compliant / Non-Compliant** on 40 Recommendations
  (technical compliance) and **High / Substantial / Moderate / Low** on 11
  Immediate Outcomes (effectiveness). Published in full, per country.
- **Soft quantifier:** **"largely" vs "partially"** compliant — the boundary is a
  documented judgment call, exactly the analog of "up to four".
- **Stresses:** the discrete three-point score path (the AI-for-SMEs shape).
  Writ reproduces the **derived** published outcome — the country's
  regular/enhanced **follow-up stream** — from the ratings, rather than the
  ratings themselves. `+1` = regular, `-1` = enhanced.
- **Independence:** high (a standing intergovernmental body; nothing to do with us).
- **Status (2026-07-23):** encoded and analyzed clean, with the follow-up rule's
  regular/enhanced branches statically verified to partition the rating space and
  computed over synthetic evidence. See
  [`methodology.writ`](../../../benchmarks/evaluator/fatf-mutual-evaluation-scaffold/methodology.writ),
  the benchmark [README](../../../benchmarks/evaluator/fatf-mutual-evaluation-scaffold/README.md), and
  `packages/benchmark/test/fatf-reproduction.test.ts`. **Still source-gated**
  (held pending, no real ratings committed): (1) the enhanced-follow-up trigger
  constants must be verified verbatim against the FATF _Procedures_; (2) the
  per-country ratings sourced from the Consolidated Assessment Ratings table; and
  (3) the actual assigned follow-up streams to reproduce against. The FATF site
  blocks automated fetch, so this last mile awaits a reachable source or a clean
  export.

### 2. World Bank CPIA

- **What:** the Country Policy and Institutional Assessment scores IDA countries
  **1–6** on 16 criteria in four clusters, each with anchor descriptions.
- **Soft quantifier:** **"adequate"** — the mid-band anchor most assessments hinge
  on.
- **Stresses:** the **graded-measure path** again, on independent data — a second
  weighted-ordinal case would test the graded-measure path against independent
  data rather than only a synthetic fixture. Directly re-exercises the new IR.
- **Independence:** high. **Caveat:** per-criterion scores are public for IDA
  countries but coverage/detail varies — check data availability before committing.

### 3. Climate Action Tracker

- **What:** rates countries' targets and policies on an ordinal band —
  _Critically insufficient → Highly insufficient → Insufficient → Almost
  sufficient → 1.5°C compatible_. Published per country.
- **Soft quantifier:** **"sufficient"** (sufficient for what warming outcome) — the
  load-bearing word is the scale itself.
- **Stresses:** ordinal band assignment + roll-up across several metrics; a
  different domain (climate) from AI and finance, which widens the generality
  claim. Governance-adjacent, so close to Sara's interests.
- **Independence:** high (an independent research consortium). **Caveat:** the
  rating rolls up several sub-assessments; encoding the roll-up faithfully is more
  work than FATF.

### 4. G7 Hiroshima AI Process — International Code of Conduct

- **What:** organizations report against voluntary AI commitments; the OECD hosts
  a reporting framework.
- **Soft quantifier:** **"appropriate measures" / "as appropriate" / "reasonable"**
  — dense soft language.
- **Stresses:** the **static gap/overlap** path on soft-commitment text — the
  purest re-run of the "up to four" finding, in the same domain as the pilot.
- **Independence:** medium. **Caveat:** it is _reporting_, not scoring — there is
  no published per-party ordinal record to reproduce, so it tests ambiguity
  detection but not score reproduction. Best as a complement, not the primary
  third case.

## Recommendation

**Lead with FATF** (public ratings, bounded rubric, a real "largely vs partially"
boundary, and unimpeachable independence) to strengthen the discrete/gap-overlap
claim on data we did not touch. **Follow with CPIA** to get a _second_
weighted-ordinal case — that pairing (a third discrete methodology + a second
graded one) is what turns the generality claim from "two shapes each once" into
"each shape, twice, on independent data." Hold Hiroshima as an ambiguity-detection
side study and Climate Action Tracker as the domain-widening option if a climate
angle becomes useful.

Next concrete step for whichever we pick: source the published scores + the rubric
text, encode the resolved methodology, and check three things — faithful
reproduction, at least one static gap/overlap or pending-decisive finding, and at
least one located soft-quantifier sensitivity.
