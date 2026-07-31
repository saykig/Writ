# Writ pilot: results and next steps

This is a historical benchmark note, not Writ's current product definition and not a corpus
identity. It records what the first scoring pilot established, what it did not, and where that
experiment pointed. For the reproducible run behind the numbers, see
[`docs/PROOF.md`](./PROOF.md) and `scripts/demo.sh`.

## Summary

In this benchmark, Writ compiles a compliance methodology into a program, evaluates it against
frozen reviewed evidence, and returns a derived reproduction with a trace anyone can recompute.
The published ratings remain source-reported judgments. The pilot ran the 2025 G7 AI-for-SMEs
chapter across all eight members. It shows
the mechanism works on real published data and produces one substantive finding:
two of the eight published scores hold only under a particular reading of the
rubric, and the tool names exactly which two and exactly which phrase. That is a
credible proof of concept for the idea. It is not yet a proof that the idea
generalizes or changes outcomes in practice.

## What was tested

One methodology (AI-for-SMEs adoption), one year (2025), one commitment, eight
members (the G7 plus the EU). Evidence is 87 real government actions drawn from
the published G7 chapter, each page-anchored to a source registry
(`sha256:9e88bb36…`) and carrying a reviewed strong / weak / countervailing
classification. Scores run on a `+1 / 0 / -1` scale.

## Results

### 1. Faithful reproduction

Under the resolved reading and the strict evidence profile, all eight computed
scores equal the published record (`8/8`, zero mismatches). Each score is
computed, not asserted: the receipt's proof root is the score-selection node, and
a `+1` cell is backed by at least five qualifying strong actions.

Be precise about what this is. The resolved methodology and the evidence were
authored so the evaluator reproduces the published record, so this is a
consistency check, not an independent prediction. It establishes that the
encoding is faithful and the evaluator is correct and deterministic. It does not,
on its own, establish that the published scores are right. The independent result
is the next one.

### 2. Located interpretation-sensitivity

Two of the eight scores, Japan and the United States, hold their published `0`
only under the strict profile. Read general, non-SME AI legislation as a
qualifying strong action (the generous profile) and both flip to `+1`. The tool
does not argue for either reading. It reports that the score turns on that choice,
names the two cells, and shows the specific measures that decide it.

This is the load-bearing finding. It converts a vague objection ("these scores are
subjective") into a precise, reproducible object: here are the exact cells, the
exact phrase, and the exact reading that moves them. A spreadsheet does not give
you that.

### 3. Static ambiguity, caught before any evidence exists

The rubric awards `0` for "up to four strong actions." Read literally (1 to 4),
that leaves an uncovered state no rule scores (`WRT-SCORE-GAP`: zero strong, five
weak). Read inclusively (0 to 4), a state is scored by two rules with different
results (`WRT-SCORE-OVERLAP`). Writ proves both statically, with a minimized
witness, and refuses to guess the intended reading. The resolved methodology,
which makes the interpretation explicit, analyzes clean.

This is exhaustiveness and overlap checking, the property a compiler checks on a
pattern match, applied to policy scoring. It is a real capability, independent of
any country's data.

## Update: a second methodology, a different scoring shape

The first named next step — a second methodology — is done, and deliberately in a
different domain *and* a different scoring paradigm: **Sara Kim's Gap Matrix** (an
AI-governance index across the EU, US, UK, and China). Where AI-for-SMEs is a
three-point `+1/0/-1` verdict, the Gap Matrix is a **weighted-ordinal measure**:
each axis is five equally-weighted components, each scored on a five-anchor
rubric (0..4), aggregated as `round(100 · Σ wᵢ·sᵢ/4)`. That shape did not exist in
Writ; expressing it required a graded-measure extension to the IR, the
evaluator, and the analyzer (see the plan and `docs/ANALYZER-SCOPE.md`).

What it shows:

- **Faithful reproduction of a genuinely different shape.** Writ recomputes
  Sara's `deriveAssessment` exactly: `public_authority` (five components at level
  2) → **50**; `knowledge_concentration` (two of five components unassessed) →
  **pending**, not a silent 0 — reproducing her "if some score is null, return
  null". Cross-checked against her formula, byte-identical hash across runs
  (`packages/benchmark/test/gap-matrix-reproduction.test.ts`).
- **Pending as a first-class, located outcome.** The analyzer reports each axis
  *pending-decisive*: the index turns on every component, so a single unresolved
  judgment carries the whole result. This is the graded analog of the
  interpretation-sensitivity finding — the "who bears the risk" localization —
  and it falls out of the same four-valued core.

One case was an anecdote; two methodologies that behave the same way — faithful
recomputation, honest pending/uncertainty, and a located point of judgment —
across two different scoring paradigms is the start of a generality claim.

## What this does not establish

- **Generality, still bounded.** Two methodologies in two domains and two scoring
  shapes, not a broad sweep. The direction is now evidenced, not merely asserted,
  but a handful of cases is not a population.
- **The judgment is still human.** Gathering evidence, translating the rubric, and
  authoring the interpretation profiles (or, for the Gap Matrix, transcribing the
  analyst assessments) were all hand work. Writ makes the judgment explicit
  and its consequences reproducible. It does not produce the judgment.
- **No user validation yet.** The analyzer's output on Sara's own Gap Matrix is
  the natural fixture for her review, but her sign-off is not recorded here and is
  not assumed. That review is the next honest step, not a claimed result.
- **Analyzer scope.** Findings are decided by bounded enumeration over declared
  finite domains; a clean result guarantees clean only within them, and query-
  driven rubric anchors are not coverage-checked. `docs/ANALYZER-SCOPE.md` states
  the bounds in full.

## How to check it

The evidence is frozen in-repo and needs no network. `bash scripts/demo.sh`
reproduces the AI-for-SMEs figures; `bun scripts/replicate.ts` re-derives every
hash and score from the frozen bytes (`docs/REPLICATION.md`); and
`bun test packages/benchmark/test/gap-matrix-reproduction.test.ts` reproduces the
Gap Matrix. The live site runs the same toolchain: the playground compiles and
analyzes arbitrary source, and the benchmark recomputes all eight cells from the
frozen corpus.

## Next steps

Status: three of the four named steps are done; the reviewer step remains.

1. ✅ **A second methodology, a different scoring shape.** Done — Sara Kim's Gap
   Matrix, ported as a weighted-ordinal measure, reproduced faithfully (see the
   Update above). It required extending the IR/evaluator/analyzer for graded
   scoring rather than reusing the three-point path.

2. ✅ **Frozen re-derivation of the evidence.** Done — `bun scripts/replicate.ts`
   re-derives every source hash, snapshot content hash, profile hash, and score
   from the in-repo bytes, and a test proves a one-character quote edit breaks the
   hash (`docs/REPLICATION.md`). What a matching hash does and does not prove is
   stated there; independent re-*gathering* by a second analyst remains open.

3. ⏳ **One real domain reviewer.** Open. The analyzer's output on Sara's own Gap
   Matrix — the pending-decisive components, the reproduced indices — is the
   natural fixture for her review. Her plain yes/no on whether it is correct and
   useful is the honest remaining validation; it is not assumed here.

4. ✅ **Analyzer scope + negative results.** Done — `docs/ANALYZER-SCOPE.md` states
   what the score and measure analyzers decide and where they are silent, and
   "clean" is a first-class reported result (the resolved AI-for-SMEs methodology
   and the Gap Matrix both report clean/well-formed within their declared bounds).
