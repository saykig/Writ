# Archived compatibility datasets

These datasets predate the native corpus-family architecture. They use compliance-oriented
record shapes governed by `schemas/compatibility/`, not the `legal_policy` or `institutional`
family contracts, so they are preserved here rather than under `corpora/`.

| Dataset | Path                            | Governing contracts                            |
| ------- | ------------------------------- | ---------------------------------------------- |
| G7 2025 AI for SMEs  | `g7/2025-ai-sme` | `schemas/compatibility/g7-benchmark-v1/`       |
| G20 2024 Rio         | `g20/2024-rio`   | `schemas/compatibility/compliance-corpus-v2/`  |

Rules:

- The files are frozen. Preserve bytes; do not reformat, renumber or re-key them.
- They are not listed in `corpora/catalog.yaml` and have no native corpus manifest.
- They must not shape native corpus manifests, catalog entries or family schemas.
- Their published judgments are source-reported and are never Writ-derived.

The move from `corpora/multilateral/` is recorded in
[`docs/migrations/corpus-family-foundation/g7-g20-archive-path-map.md`](../../docs/migrations/corpus-family-foundation/g7-g20-archive-path-map.md).
