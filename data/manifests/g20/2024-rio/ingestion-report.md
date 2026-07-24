# 2024 Rio ingestion and validation report

## Scope

The G20 2024 Rio adapter parses the G20 Research Group interim and final compliance reports into
version `2.0.0` normalized records. Published scores are imported exactly. No compliance score is
computed or inferred; ambiguous or missing extractions become review-queue items. Interim and final
are kept as separate `compliance_report` records.

## Source documents

| Stage | Document | Assessment window | Published | Members | Commitments |
|---|---|---|---|---|---|
| Interim | 2024-g20-compliance-interim.pdf | 2024-11-20 to 2025-05-31 | 2025-09-16 | 21 | 13 of 174 |
| Final | 2024-g20-compliance-final.pdf | 2024-11-20 to 2025-08-20 | 2025-11-18 | 21 | 13 of 174 |

Both reports assess the same 21 members (the 19 member states, the African Union, and the European
Union) against the same 13 commitments selected for compliance monitoring. Scores use the published
-1 / 0 / +1 scale; `n/a` cells are imported as `not_applicable`.

## Normalized record counts

- Identified commitments: 13 (the selected subset; the full 174-commitment inventory is not
  enumerated in the compliance reports — see reconciliation below)
- Assessment selections: 13 selected, 0 not_selected, 0 unknown
- Compliance reports: 2 (1 interim, 1 final; separate records)
- Member compliance assessments: 546 (273 interim + 273 final)
- Published scores: 546; missing/null scores: 0
- Score distribution: +1 = 247, 0 = 237, -1 = 60, not_applicable = 2
- Reconciliation manifests: 1 (expected inventory 174, expected selected 13, status `incomplete`)
- Review-queue items: 15

## Validation checks

- Inventory and selected-subset counts match the source: 174 total commitments and 13 selected are
  recorded in the reconciliation manifest; 13 selected commitments materialized.
- Interim and final remain separate: two distinct `compliance_report` records with distinct stages,
  windows, publication dates, and member-assessment sets; neither supersedes the other.
- Published scores imported exactly: `member_compliance_assessment.published_result` equals the
  printed cell; `n/a` maps to `not_applicable`. Spot-checked against Table 2 of each report.
- Missing extraction stays null: no blank or unreadable score cells were found; any such cell would
  be emitted as `score_status = missing`, `published_result = null`, with a review item.
- No unselected or unknown commitment receives an assessment: assessments exist only for the 13
  `selected` commitments (enforced by graph validation).
- Repeated runs produce identical normalized output: the materialized record set is byte-stable
  across re-runs (deterministic ids, canonical JSON).
- `validate_corpus_graph` and per-record schema validation pass for every emitted record.

## Interim vs final differences

The selected commitment set and member set are identical across the two reports; the published
scores differ (the final report reflects the longer monitoring window). Both versions are retained
as separate records; `current_member_assessments` is not applied here, so neither is dropped.

## Review queue (15 items, all pending)

- `missing_required_date` x13 — no per-commitment selection date is published; one item per selection.
- `incomplete_reconciliation` x1 — the full 174-commitment inventory is not enumerated in the
  compliance reports (only the 13 selected are printed). The reconciliation records the expected
  counts; enumerating the full inventory requires the separate G20 Rio commitments source.
- `conflicting_source_records` x1 — the final report cover states a coverage span ending
  2025-11-05 while the scoring section states the monitoring window ends 2025-08-20. The monitoring
  window is used for the assessment window; the discrepancy is surfaced rather than resolved.

## Provenance

Fixture excerpts under `benchmark/2024-rio-g20/sources/` contain only the cover, scoring-window,
Table 1, and Table 2 pages of the public reports; `benchmark/2024-rio-g20/sources.json` records the
full-source SHA-256 for each report. The frozen normalized record set is under
`benchmark/2024-rio-g20/normalized/`.

## Source acquisition (Stage 2)

The registered `g20_research_group` source is enabled (`terms_status: reviewed`,
`verification_status: verified`). Both report PDFs were fetched under approved live access
(`scripts/fetch_sources.py --approved-live-access`) through the domain allowlist and published to the
append-only Neon corpus store as immutable, content-addressed `raw_source` objects
(final 17,942,825 bytes; interim 9,356,340 bytes). `source-manifest.json` records their object ids
and SHA-256 digests. Re-running the adapter against the full fetched PDFs produces normalized output
byte-identical to the fixture run, and re-publishing the same bytes is a no-op (`created: false`).
Runtime database credentials are never stored in repository files or provenance.
