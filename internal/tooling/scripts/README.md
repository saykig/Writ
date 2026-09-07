# Repository scripts

Scripts are operational tooling, not sources of corpus truth.

- `validate_pack.py` and `validate_pack.sh` check schemas, fixtures, protocols, and task metadata
  without network access.
- `generate_source_registry.py` builds the compatibility projection in
  `internal/infrastructure/generated/` from reviewed configuration.
- `corpus_family_inventory.ts` and `institutional_stage_b_inventory.ts` reproduce preservation
  inventories for retained reviewed corpora.
- `discover_sources.py` builds a caller-reviewed source manifest without live discovery.
- `fetch_sources.py` plans acquisition by default. Supplied-file or approved live acquisition
  requires an explicit `--output`, writes exact bytes without overwrite, and reports SHA-256 and
  acquisition provenance without inserting or accepting corpus records.

Never treat a generated candidate as reviewed evidence merely because a script emitted it.
