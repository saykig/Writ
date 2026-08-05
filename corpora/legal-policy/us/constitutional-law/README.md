# United States constitutional-law corpus

This draft corpus is generated only from the `constitutions` subset of
`vaquill/open-us-law`, snapshot `v2026.07`. The checked-in records are a validated
three-jurisdiction sample (federal, Alabama, and Puerto Rico), not a claim of complete coverage.

The upstream subset contains 7,762 rows across the federal Constitution, all 50 states, and Puerto
Rico. It contains no District of Columbia constitutional file and no constitutional file for the
other territories. Upstream `source_url` is null for the federal and state files and is preserved
as explicit null in compiled metadata.

Every imported record remains `draft`; legal force, applicability, enforcement, and adoption are
`unknown`. The importer performs no keyword topic assignment and separates acquisition from
deterministic rendering. A full dry-run projects 1,076 files totaling 39,561,454 bytes, above the
repository's 10 MiB corpus gate, so the full output is intentionally not checked in.
