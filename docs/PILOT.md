# Covenant pilot: results and next steps

A short, honest read on what the first pilot established, what it did not, and
where it should go. For the reproducible run behind the numbers, see
[`docs/PROOF.md`](./PROOF.md) and `scripts/demo.sh`.

## Summary

Covenant compiles a compliance methodology into a program, evaluates it against
frozen reviewed evidence, and returns a score as a receipt anyone can recompute.
The pilot ran the 2025 G7 AI-for-SMEs chapter across all eight members. It shows
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
that leaves an uncovered state no rule scores (`COV-SCORE-GAP`: zero strong, five
weak). Read inclusively (0 to 4), a state is scored by two rules with different
results (`COV-SCORE-OVERLAP`). Covenant proves both statically, with a minimized
witness, and refuses to guess the intended reading. The resolved methodology,
which makes the interpretation explicit, analyzes clean.

This is exhaustiveness and overlap checking, the property a compiler checks on a
pattern match, applied to policy scoring. It is a real capability, independent of
any country's data.

## What this does not establish

- **Generality.** One methodology, one domain, one year. That the same behaviors
  appear elsewhere is asserted, not shown.
- **The judgment is still human.** Gathering evidence, translating the rubric, and
  authoring the interpretation profiles were all hand work. Covenant makes the
  judgment explicit and its consequences reproducible. It does not produce the
  judgment. This is a narrower claim than "automates compliance scoring," and the
  narrower claim is the honest one.
- **No user validation.** That an auditor or a multilateral body would find this
  worth adopting is plausible and argued, not tested with a real reviewer.
- **Analyzer scope.** Gap and overlap detection runs by bounded enumeration over
  declared finite domains. A "no findings" result guarantees clean only within
  that bounded domain; rubric shapes outside it would need the solver path.

## How to check it

The evidence is frozen in-repo and needs no network. `bash scripts/demo.sh`
reproduces every figure above. The live site runs the same toolchain: the
playground compiles and analyzes arbitrary source, and the benchmark recomputes
all eight cells from the frozen corpus.

## Next steps

In priority order. The first one is the credibility multiplier; the rest harden
the claim.

1. **A second methodology in a different domain.** Pick a G7, OECD, or
   multilateral commitment with published per-member scores and a rubric that
   contains at least one soft quantifier or scope term ("adequate," "substantial,"
   "where feasible," "up to N"). Show the same three behaviors: faithful
   reproduction, at least one static gap or overlap, and at least one located
   sensitivity flip. One case is an anecdote. Two that behave the same way is the
   start of a claim.

2. **Independent replication of the evidence step.** Have a second person
   independently gather evidence for one or two members from the same source
   registry and confirm the receipts match, or surface where they diverge. This
   tests the weakest link in the reproduction claim: whether "frozen reviewed
   evidence" is reproducible across analysts.

3. **One real domain reviewer.** Show the sensitivity output to someone who works
   on compliance scoring and get a plain yes or no on whether "Japan and the US
   turn on this phrase" is correct and useful. One honest expert reaction is worth
   more than another benchmark.

4. **Document analyzer scope, and publish negative results.** State what rubric
   shapes the bounded analyzer can and cannot decide. When a methodology is clean,
   say so. A tool that sometimes returns "this rubric has no gaps and no
   sensitivity" is more trustworthy than one that always finds something.
