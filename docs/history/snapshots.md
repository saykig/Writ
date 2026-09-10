# Historical snapshot ledger

These frozen bodies are no longer tracked on current `main`. Lightweight Git tags point to the
commits where the exact retained bytes first reached their final form. Dates below come from the
identified commits; no tag or commit metadata was rewritten or backdated.

The recorded SHA-256 is relocation-independent. For every tracked file in bytewise-sorted relative
path order, hash its UTF-8 relative path, one NUL byte, its exact contents, and one NUL byte. File
counts and digests therefore describe the recovered snapshot tree, independent of its checkout
location.

| Snapshot                      | Purpose                                                                                                                              | Original creation                                                      | Exact-byte finalization                                                | Tag and target commit                                                                 | Historical path at tag                  | Files | Tree SHA-256                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------- | ----: | ------------------------------------------------------------------ |
| EU-US AI evaluation v1        | Frozen combined pilot, reviewed inputs, normalized outputs, provenance, local schemas, reference code/tests, and research report     | `1fbae0a8d883312acfdeffea49e1ffe874a97090` — 2026-07-27T19:06:32-04:00 | `60d5b5e023fb3578db323e424136f3100b561952` — 2026-07-31T05:14:18-04:00 | `snapshot/eu-us-ai-evaluation-v1` → `60d5b5e023fb3578db323e424136f3100b561952`        | `archive/pilots/eu-us-ai-evaluation-v1` |    29 | `3ca03cc4bf3d0bb43d3c7cea9bdbac59c28a8615cb903139094e3ebecd122a33` |
| G7 2025 AI-SME                | Frozen compatibility corpus and source-reported assessment material                                                                  | `27a462a20567bab05a98d3ab8547ad6421a362d4` — 2026-07-23T05:20:43-04:00 | `9cf9187e07cfa53f019bf33e363447047ca161a4` — 2026-07-31T13:02:43-04:00 | `snapshot/g7-2025-ai-sme` → `9cf9187e07cfa53f019bf33e363447047ca161a4`                | `corpora/multilateral/g7/2025-ai-sme`   |    12 | `f8ae684ae6dd8f0fda247abb73ed36e3ad46345dcf7cba89ed5d11501bb00dc7` |
| G20 2024 Rio                  | Frozen compatibility corpus, source excerpts, provenance, and source-reported judgments                                              | `b35f703d9a0b633f6541fee44dead622946e09d7` — 2026-07-24T14:00:07-04:00 | `8c149002d0e371e4dc3f605bbbbed216f4297189` — 2026-07-31T05:43:56-04:00 | `snapshot/g20-2024-rio` → `8c149002d0e371e4dc3f605bbbbed216f4297189`                  | `corpora/multilateral/g20/2024-rio`     |    16 | `462605d2c441beb5e7caaa82139b7ab5f9e02ae4ed772a1e82bfcade74bd5965` |
| Revisable assessment pilot v1 | Completed disposable assessment demonstration, frozen recipient evidence, Vela receiving artifacts, local HTML/CLI, and replay tests | `93580e61cd60cdb87e928a2f55045b2013a3d8bf` — 2026-09-09T21:13:25-04:00 | `c09922f8a4689284de42b1b1bcc22098fa19c117` — 2026-09-09T22:27:36-04:00 | `snapshot/revisable-assessment-pilot-v1` → `c09922f8a4689284de42b1b1bcc22098fa19c117` | `examples/assessments/revisable-pilot`  |    60 | `de021abf955867ac0de06cfd8858a366a8ce07aa1a9fe455cc1e54669e70da07` |
| Revisable assessment view v1  | Private demonstration-only assessment HTML/CLI and its focused replay tests                                                          | `6200eb1d326427eab3d12bc694aa53ea7eaee5c8` — 2026-09-09T21:57:20-04:00 | `c09922f8a4689284de42b1b1bcc22098fa19c117` — 2026-09-09T22:27:36-04:00 | `snapshot/revisable-assessment-pilot-v1` → `c09922f8a4689284de42b1b1bcc22098fa19c117` | `packages/assessment-view`              |    10 | `9df26ff833a8d50f5dbcb66ccc68f7f0ae3954b89ea448038042b734ec530309` |

The G7 and G20 tags predate the later byte-identical move into `archive/compatibility/`, so their
recovery paths are the earlier `corpora/multilateral/` paths shown in the table. G20 acquisition
manifests first appeared earlier in `d68e28490d60d747ac79a85a57c5c7b4fe998bfe`; the table records
the creation of the complete snapshot body.

Recover each tree into a clean checkout with:

```bash
git checkout snapshot/eu-us-ai-evaluation-v1 -- archive/pilots/eu-us-ai-evaluation-v1
git checkout snapshot/g7-2025-ai-sme -- corpora/multilateral/g7/2025-ai-sme
git checkout snapshot/g20-2024-rio -- corpora/multilateral/g20/2024-rio
git checkout snapshot/revisable-assessment-pilot-v1 -- \
  examples/assessments/revisable-pilot packages/assessment-view
```

The EU-US tree contains its own `MANIFEST.sha256`, which covers all 28 other files and verifies
successfully. The G7 and G20 source manifests retain their source-document and passage hashes; their
whole-tree digests are the values above and were already recorded by Writ's corpus-family migration
inventory.

Active EU and US legal-policy migration maps retain 38 `archive_pointer` values relative to the
EU-US snapshot root. Resolve those pointers only after recovering
`snapshot/eu-us-ai-evaluation-v1` at its historical path; they are provenance coordinates, not a
current filesystem dependency.
