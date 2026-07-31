# G7 2025 AI-for-SMEs score reproduction

This internal directory is a historical evaluator benchmark, not a political corpus or Writ's
primary demonstration. It consumes
the authoritative G7 records in `corpora/multilateral/g7/2025-ai-sme/`.

`assignments.json` holds the 87 reviewed strong/weak/counter assignments made
under the reconstructed methodology. `assignment-reviews.json` preserves their
human reviews. Profiles, rubric, generated evidence projections, expected
Writ-derived results, and the discrepancy ledger remain here because they test
evaluator behavior.

Source-reported ratings stay in the corpus. `expected-results.json` refers to
them only for comparison and identifies every expected computation as
`origin: writ_derived`.
