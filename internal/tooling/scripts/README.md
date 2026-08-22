# Repository scripts

Scripts are operational tooling, not sources of corpus truth.

- `validate_pack.py` and `validate_pack.sh` check schemas, fixtures, protocols, and task metadata
  without network access.
- `generate_source_registry.py` builds the compatibility projection in
  `internal/infrastructure/generated/` from reviewed configuration.
- `corpus_family_inventory.ts` and `institutional_stage_b_inventory.ts` reproduce preservation
  inventories for retained reviewed corpora.
- `publish_corpus.ts` is generic publication tooling; publishing a candidate never accepts it.
- `discover_sources.py` and `fetch_sources.py` are generic acquisition tools; running them may
  require explicit source access and does not automatically accept or publish records.

Never treat a generated candidate as reviewed evidence merely because a script emitted it.
