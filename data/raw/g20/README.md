# G20 raw source layer

Raw corpus bytes are stored online in the append-only Neon `corpus_blobs` and
`corpus_objects` tables. This directory contains policy documentation only.

- Do not place or manually edit corpus source files here.
- Import supplied files with `scripts/fetch_sources.py --supplied-file`; the command publishes
  bytes directly to Neon and requires `DATABASE_URL` at runtime.
- Run live fetching only after explicit approval and with `--approved-live-access`.
- A changed source produces a new SHA-256 object version. Existing bytes are never overwritten.
- Raw availability does not imply acceptance as evidence or permission to redistribute.

The 2024 Rio interim and final compliance report PDFs have been fetched under approved live access
and published to the Neon corpus store. See `data/manifests/g20/2024-rio/source-manifest.json` for
their content-addressed object ids and SHA-256 digests. No source bytes are stored in this tree.
