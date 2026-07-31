# Repository scripts

Scripts are operational tooling, not sources of corpus truth.

- `validate_pack.py` and `validate_pack.sh` check schemas, fixtures, task metadata, and semantic
  conformance without network access.
- `validate_corpus.py` checks active corpus shape and preserved inventories.
- `emit_g20_rio.py`, `migrate_eu_us_corpora.py`, and `publish_corpus.ts` are deterministic migration
  or publication utilities whose checked-in outputs remain authoritative only in their documented
  corpus locations.
- `generate_source_registry.py` builds the compatibility projection in
  `internal/infrastructure/generated/` from reviewed configuration.
- `discover_sources.py`, `fetch_sources.py`, `parse_assessments.py`, `parse_commitments.py`, and
  `build_benchmarks.py` are acquisition or preparation tools; running them may require explicit
  source access and does not automatically accept or publish records.
- `replicate.ts` re-derives the historical G7 evaluator benchmark from frozen inputs. Its former
  demonstration script is bounded with the G7 compatibility fixture under `internal/verification/`.

Never treat a generated candidate as reviewed evidence merely because a script emitted it.
