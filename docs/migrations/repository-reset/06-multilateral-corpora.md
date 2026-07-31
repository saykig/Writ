# Prompt 6 path maps

## G7 political corpus

| Previous path | Current path |
| --- | --- |
| `benchmark/2025-ai-sme/sources.json` | `corpora/multilateral/g7/2025-ai-sme/sources/source-manifest.json` |
| `benchmark/2025-ai-sme/sources/g7-2025-ai-sme-chapter.pdf` | `corpora/multilateral/g7/2025-ai-sme/sources/g7-2025-ai-sme-chapter.pdf` |
| Action, actor, and anchor data embedded in benchmark snapshots/catalog | `corpora/multilateral/g7/2025-ai-sme/records/`, `sources/`, and `reviews/` |
| Published assessment cells embedded in the methodology inventory | `corpora/multilateral/g7/2025-ai-sme/records/published-judgments.json` |

Every former action and classification claim association resolves through the
corpus `migration-map.json`.

## G7 evaluator benchmark

| Previous path | Current path |
| --- | --- |
| `benchmark/2025-ai-sme/evidence/` | `benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/evidence/` |
| `benchmark/2025-ai-sme/profiles/` | `benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/profiles/` |
| `benchmark/2025-ai-sme/methodology-inventory.json` | `benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/methodology-inventory.json` |
| `benchmark/2025-ai-sme/discrepancy-ledger.json` | `benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/discrepancy-ledger.json` |
| `benchmark/2025-ai-sme/reviewed-tally.md` | `benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/reviewed-tally.md` |
| `benchmark/2025-ai-sme/rubric-and-scores.md` | `benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/rubric-and-scores.md` |

The 87 methodology-specific assignments and their reviews are now explicit in
`assignments.json` and `assignment-reviews.json`. Expected computations are
separate Writ-derived records in `expected-results.json`.

## G20 political corpus

| Previous path | Current path |
| --- | --- |
| `benchmark/2024-rio-g20/sources.json` | `corpora/multilateral/g20/2024-rio/sources/source-manifest.json` |
| `benchmark/2024-rio-g20/sources/*` | `corpora/multilateral/g20/2024-rio/sources/*` |
| `benchmark/2024-rio-g20/normalized/commitments.json` | `corpora/multilateral/g20/2024-rio/records/political-statements.json` |
| `benchmark/2024-rio-g20/normalized/selections.json` | `corpora/multilateral/g20/2024-rio/records/assessment-selections.json` |
| `benchmark/2024-rio-g20/normalized/reports.json` | `corpora/multilateral/g20/2024-rio/records/published-reports.json` |
| `benchmark/2024-rio-g20/normalized/member_assessments.json` | `corpora/multilateral/g20/2024-rio/records/published-judgments.json` |
| `benchmark/2024-rio-g20/normalized/reconciliations.json` | `corpora/multilateral/g20/2024-rio/provenance/reconciliation.json` |
| `benchmark/2024-rio-g20/normalized/review_queue.json` | `corpora/multilateral/g20/2024-rio/reviews/review-queue.json` |
| `data/manifests/g20/2024-rio/*` | `corpora/multilateral/g20/2024-rio/provenance/*` |
| `data/raw/g20/README.md`, `data/normalized/g20/README.md` | Removed; the directories contained no unique data |

The G20 migration map resolves all 13 statement identifiers and all 546
published judgment identifiers.
