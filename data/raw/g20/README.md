# G20 raw source layer

Raw corpus bytes are stored online in the append-only Neon `corpus_blobs` and
`corpus_objects` tables. This directory contains policy documentation only.

- Do not place or manually edit corpus source files here.
- Import supplied files with `scripts/fetch_sources.py --supplied-file`; the command publishes
  bytes directly to Neon and requires `DATABASE_URL` at runtime.
- Run live fetching only after explicit approval and with `--approved-live-access`.
- A changed source produces a new SHA-256 object version. Existing bytes are never overwritten.
- Raw availability does not imply acceptance as evidence or permission to redistribute.

Phase 1A contains no G20 source bytes.
