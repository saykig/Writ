# `@writ/language`

Langium grammar, parser recovery, symbol linking, formatter, source maps, AST-to-IR compiler, and LSP.

Keep public APIs small, versioned, and covered by conformance fixtures.

## Record syntax migration

The canonical record contract uses structured subjects and expanded scope. New source should use
`subject <id> type <type>` entries, plural `jurisdictions`, `institutional_scope`,
`temporal_scope`, and `conditions`. Institutional mandates use an explicit `status`; mission text
is a separate object and does not imply mandate, authority, function, or operational capacity.

Institutional grammar v0.2 adds an atomic `fact_type` and one fact-specific payload. Record
judgments may target either a `record` or a `record_link`; judgments remain outside both native
record families.

Writ 0.1 source compatibility is deterministic:

- `subjects { id };` compiles to `{ subject_id: "id", subject_type: "unspecified" }`;
- `scope { jurisdiction "X"; condition "Y"; }` compiles to plural jurisdictions, empty
  institutional and temporal scopes, and a conditions array;
- `mandate "text";` compiles with `status: "unknown"` and preserves the text;
- legacy `authority_sources` values are moved to that mandate's `authority_source_ids`.

These rules perform no inference. They preserve existing `.writ` programs while making uncertainty
explicit in the compiled record.
