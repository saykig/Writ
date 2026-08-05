# G20 2024 Rio corpus

This is the authoritative multilateral corpus for the ingested portion of the
2024 Rio material. It preserves exactly 13 political statements, 13 assessment
selections, two reports, 546 source-reported member judgments, one incomplete
reconciliation record, and 15 review-queue records.

The source reports an inventory of 174 statements. Only 13 are ingested. The
remaining 161 are recorded as missing coverage in
`provenance/reconciliation.json`; no placeholder statements or actions are
fabricated.

Each published judgment declares `origin: source_reported`,
`writ_derived: false`, its publisher, report, subject, statement, methodology,
scale, and source passage. The empty action-family file is intentional: callers
can query statements and actions without invoking compliance evaluation and
without inventing government actions from a published score.

Frozen source excerpts, full-source and excerpt hashes, source passages,
reconciliation evidence, and acquisition notes remain together in this corpus.
