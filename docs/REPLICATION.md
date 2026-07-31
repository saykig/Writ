# Frozen-evidence re-derivation

The pilot named its weakest link honestly: reproduction is a *consistency check*,
and the part it does not test is whether the frozen, reviewed evidence is itself
reproducible. This protocol tests re-derivation of that evidence from the bytes
already in the repository — no network, no regeneration from the seed.

Run it:

```bash
bun scripts/replicate.ts
```

It exits non-zero on any divergence and prints one line per check. The logic is
`packages/benchmark/src/replicate.ts` (`replicate()`), gated in CI by
`packages/benchmark/test/replication.test.ts`.

## What is re-derived

1. **Source bytes.** The raw SHA-256 of `corpora/multilateral/g7/2025-ai-sme/sources/g7-2025-ai-sme-chapter.pdf`
   must equal the `document_versions[].sha256` recorded in the snapshots.
2. **Snapshot content hash.** For each `evidence/<member>.snapshot.json`, the
   stored `snapshot.content_hash` must equal
   `sha256Canonical({ passages, claims, actions, reviews })` recomputed from the
   snapshot's own arrays. Any edit to a quote, page anchor, classification claim,
   action, or review changes this hash.
3. **Interpretation-profile hash.** Each `profiles/<name>.profile.json`
   `canonical_hash` must equal `sha256Canonical(profile, drop /canonical_hash,
   /signature)` — the same recipe that produced it.
4. **Scores.** The deterministic evaluator, re-run over the frozen evidence,
   reproduces the published record (8/8) and every receipt's `canonical_hash`
   verifies (`verifyReceipt`).

## What a matching hash proves — and what it does not

A matching content hash proves the snapshot's reviewed content is exactly what
was hashed: an independent analyst who reproduces the same page-anchored quotes,
the same strong/weak/countervailing classifications, the same instrument ids and
dates, byte-for-byte (NFC-normalized), gets the same hash. That is the intended
test of the weakest link.

It does **not** prove:

- **Anchor hashes are independently re-derivable from the snapshot alone.** A
  passage's `anchor_hash = sha256Canonical({ page, quote, footnote })` folds in
  the source *footnote number*. The active corpus stores that locator explicitly,
  while the compatibility snapshot omits it. So the harness re-derives the snapshot content
  hash, not each passage's anchor hash. Re-deriving anchor hashes requires the
  source registry, not just the frozen snapshot.
- **The classifications are correct.** Re-derivation checks reproducibility, not
  judgment. Whether an action is "strong" is the analyst call the interpretation
  profiles make explicit; the pilot's interpretation-sensitivity result is where
  that judgment is surfaced, not hidden.

## Tampering is caught

`replication.test.ts` mutates a single character of one passage quote and asserts
the recomputed content hash diverges from the stored one. This is the property
that makes the frozen ledger auditable: you cannot change what the evidence says
without changing its hash, and the receipt that depends on it.
