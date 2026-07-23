# Writ works: a demonstration

This document shows the system doing the thing it exists to do, on real data,
reproducibly. Run `bash scripts/demo.sh` from a clean checkout to reproduce every
line below (the benchmark needs no network; the evidence is frozen in-repo).

## What Writ is for

A G7 compliance score is a number on a `+1 / 0 / -1` scale, and behind each number
is a methodology, a pile of public evidence, and — usually invisibly — a set of
judgment calls. Writ makes the methodology a program, the evidence a frozen
reviewed ledger, and the score a receipt you can recompute and audit. Two things
fall out of that: the analyzer catches ambiguity in the *methodology* before any
evidence exists, and the discrepancy ledger names exactly where a *score* depends
on judgment rather than public fact.

## 1. The language compiles to a canonical IR

`examples/2025-ai-sme-literal.writ` compiles to an IR whose canonical hash is
byte-identical to the hand-authored golden IR. The textual DSL is a convenience;
the typed IR is the artifact of record.

## 2. The analyzer catches a real methodology defect before any evidence

The 2025 G7 AI-for-SMEs rubric awards `0` for "up to four strong actions." Read
literally that leaves a **gap** — 0 strong and 5 weak actions match no rule — and,
under a different normalization, an **overlap**. Writ finds both statically,
with a minimized witness, and refuses to guess which reading was intended:

```
literal reading:
  WRT-SCORE-GAP     ... (counter_exists=false, strong_count=0, weak_count=5)
  WRT-SCORE-OVERLAP ... rules `partial` and `none` ...
resolved reading:
  no score-analysis findings
```

The resolved methodology, which makes the interpretation explicit, analyzes clean.

## 3. The benchmark reproduces all 8 published G7 scores from frozen evidence

Every member's published AI-for-SMEs score is recomputed by the deterministic
evaluator over 87 real government actions, each drawn from the published G7
chapter (`benchmark/2025-ai-sme/sources/`, `sha256:9e88bb36…`), page-anchored, and
carrying a reviewed strong/weak/countervailing classification.

```
summary: {"cells":8,"matches":8,"mismatches":0,"interpretation_sensitive_cells":2}
  canada          +1 -> +1  MATCH
  france          +1 -> +1  MATCH
  germany         +1 -> +1  MATCH
  italy           +1 -> +1  MATCH
  japan            0 ->  0  MATCH  [interpretation-sensitive]
  united_kingdom  +1 -> +1  MATCH
  united_states    0 ->  0  MATCH  [interpretation-sensitive]
  european_union  +1 -> +1  MATCH
```

The scores are **computed, not asserted** — the tests verify each receipt's proof
root is the score-selection node and that a `+1` cell has ≥5 qualifying strong
actions by id.

### Why this is the useful part

Six cells reproduce with wide margin and no judgment call. **Japan and US do not.**
Their published `0` holds only if general, non-SME-targeted AI legislation and
strategy documents are read as *weak*; a generous reading that counts them as
strong flips both to `+1`. The discrepancy ledger tags exactly those two cells
`implicit_analyst_interpretation`. That ledger — a precise map of where the score
stops being a fact and starts being a judgment — is worth more than the score
column itself.

## 4. Receipts are deterministic and tamper-evident

The same inputs produce a byte-identical receipt every run. Flip one field and the
recomputed hash no longer matches the stored one:

```
verify authentic:  OK        canonical_hash sha256:f4d240ad…
verify tampered:   TAMPERED  stored sha256:f4d240ad…  computed sha256:9af7472f…
```

## 5. The evidence is governed

The evidence never enters a score by accident. Claims and actions are created as
candidates, transition through explicit `submit → accept` commands, and only
accepted-and-reviewed evidence within the cutoff is eligible. The API enforces
role separation (no self-approval), optimistic concurrency, idempotent commands,
and an append-only audit hash-chain; published snapshots, receipts, and releases
are immutable at the database level. A frozen snapshot exports schema-valid
evaluator input, and later evidence cannot change it.

## How to reproduce

```bash
bash scripts/demo.sh          # the four sections above, end to end
bun run conformance           # the implementation-independent semantic corpus
bun test                      # the full suite
```

## Coverage

~493 automated tests across the semantic core, language, analyzer, evidence
ledger, and benchmark, plus a 130-case implementation-independent conformance
corpus with mutation tests proving the suite is sensitive. Every quality gate —
format, lint, typecheck, test, conformance — is green. The evaluator and analyzer
carry no network, clock, or randomness; the same inputs always yield the same
receipt.
