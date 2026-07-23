# 2026 frontier-AI governance — the Gap Matrix, ported to Covenant

This corpus ports **Sara Kim's Gap Matrix** (from `cepheus`, the essay _What We
Owe to Each Other_) into Covenant, as the project's second methodology and the
first that exercises the **graded weighted-ordinal measure** (a scoring shape the
original 3-point `+1/0/-1` AI-for-SMEs benchmark could not express).

## What it measures

One frontier-AI governance field, assessed holistically across the European
Union, United States, United Kingdom, and China, on two weighted-ordinal axes:

- **knowledge_concentration** — how concentrated operational control, critical
  resources, information, evaluation capability, and expertise are (who knows).
- **public_authority** — binding mandate, information access, independent
  evaluation, enforcement, and coordination (who decides).

Each axis is five equally-weighted components; each component is scored on a
five-anchor ordinal rubric (0..4). The axis index is
`round(100 · Σ wᵢ·sᵢ / 4)` — byte-identical to Sara's `calculateWeightedScore`.
The distance between the two indices is the governance **gap**: the space between
who knows and who decides.

## Encoding

- The methodology of record is [`examples/ai-governance-gap-matrix.covenant`](../../examples/ai-governance-gap-matrix.covenant),
  generated from Sara's `fields.json` + `scoring-rubrics.json` by
  [`scripts/gen-gap-matrix.py`](../../scripts/gen-gap-matrix.py). Each rubric
  component becomes a `measure` component; each ordinal anchor keeps its prose
  definition as a comment.
- Each analyst assessment is a reviewed `assessed_level` evidence claim. A
  component with no reviewed level claim is **pending** — and by propagation the
  whole axis index is pending (never a silent 0), reproducing her
  `if some score is null, return null`.
- `assessments.json` here is the transcribed assessment data (component, weight,
  assessed level, status), sourced from `cepheus` `component-assessments.json`.

## The result (reproduced, not asserted)

Sara's current live assessment is deliberately partial, which makes it a real
demonstration of pending propagation:

| axis                    | components             | Covenant index | matches Sara |
| ----------------------- | ---------------------- | -------------- | ------------ |
| public_authority        | all five at level 2    | **50**         | ✓            |
| knowledge_concentration | two of five unassessed | **pending**    | ✓            |

The static analyzer additionally reports each axis as _pending-decisive_: the
index depends on every component, so any single unresolved judgment blocks it —
the "who bears the risk" localization, before any more evidence is gathered.

## Verification

`packages/benchmark/test/gap-matrix-reproduction.test.ts` compiles the
methodology, evaluates it against the assessment evidence, and asserts the
reproduction above (cross-checked against Sara's formula, byte-identical hash
across runs) and the analyzer findings.
