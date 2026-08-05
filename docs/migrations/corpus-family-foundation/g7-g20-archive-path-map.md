# G7 and G20 archive path map

`corpora/` is the active native corpus architecture and holds only family-governed
`legal_policy` and `institutional` corpora resolved through `corpora/catalog.yaml`. The G7 and
G20 datasets are compliance-oriented compatibility material from an earlier programme. They are
not a native family, so they moved out of `corpora/` and are preserved as archived compatibility
datasets.

The move is a rename only. No file content changed.

## Paths

| Old path                            | New path                                 |
| ----------------------------------- | ---------------------------------------- |
| `corpora/multilateral/g7/2025-ai-sme`  | `archive/compatibility/g7/2025-ai-sme`   |
| `corpora/multilateral/g20/2024-rio`    | `archive/compatibility/g20/2024-rio`     |

`corpora/multilateral/` no longer exists.

## Preservation

Both trees are byte-identical to their pre-move state. The tree digests recorded in
`pre-migration-inventory.json` are computed over tree-relative paths and file bytes, so they are
unchanged by the move:

| Tree | Files | SHA-256                                                            |
| ---- | ----- | ------------------------------------------------------------------ |
| G7   | 12    | `f8ae684ae6dd8f0fda247abb73ed36e3ad46345dcf7cba89ed5d11501bb00dc7` |
| G20  | 16    | `462605d2c441beb5e7caaa82139b7ab5f9e02ae4ed772a1e82bfcade74bd5965` |

`internal/verification/integration/corpora/test_archived_compatibility_datasets.py` asserts both
digests, asserts the record and judgment counts, and asserts that neither dataset appears in
`corpora/catalog.yaml` or under `corpora/`.

Four archived files still name their old repository path in their own text: the two `corpus.yaml`
`authority` fields, the G20 source manifest `fixture_path` values, and the G20 ingestion report.
Those are frozen self-descriptions inside the archived datasets. Rewriting them would change
archived bytes, so they are left exactly as recorded and this document is the authority for the
current location.

## Consumers updated

The datasets remain readable by the existing adapters, benchmark reproduction and publishing
tooling; only their root path changed.

- `packages/benchmark/src/paths.ts`, `packages/benchmark/test/multilateral-corpora.test.ts`
- `apps/ingest/src/writ_ingest/corpus/adapters/g7_2025_ai_sme.py`, `.../adapters/g20.py`
- `internal/tooling/scripts/{validate_corpus.py,publish_corpus.ts,emit_g20_rio.py,corpus_family_inventory.ts}`
- `internal/infrastructure/config/source_registry.yml` and its generated projection
- `apps/web/next.config.ts` file-tracing globs
- `internal/verification/benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/*`

No native corpus resolver reads these paths. `corpora/catalog.yaml` does not list them, and the
catalog contract permits only `legal_policy` and `institutional` entries.

The completed `docs/migrations/repository-reset/` records are historical and still describe the
`corpora/multilateral/` layout that was correct when they were written.
