# G7 2025 AI adoption for SMEs corpus

This is the authoritative source-grounded political corpus for the G7 Research
Group chapter on AI adoption for SMEs. It contains eight actors, one political
statement, 87 actions, 87 statement-action relationships, the frozen source,
page and footnote anchors, 87 action reviews, and eight source-reported ratings.

Actions have no intrinsic `strong`, `weak`, or `counter` property. Those 87
methodology assignments, their reviews, profiles, rubric, expected derived
results, and discrepancy ledger live in
`benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/`.

Every external rating declares `origin: source_reported` and
`writ_derived: false`. A benchmark result separately declares its methodology,
version, inputs, and trace. Querying `records/actions.json` does not run either
methodology or scoring.

The migration map preserves every former snapshot/action/claim association.
