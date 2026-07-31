# Saved queries

`queries/` contains reproducible inquiry-layer objects. A saved query references versioned
corpora; it never changes a corpus manifest or makes the question part of corpus identity.

The minimal contract is a YAML object with:

- `query_id`, `query_version`, `question`, and `status`;
- `corpora`, each naming a `corpus_id`, `corpus_version`, and manifest path;
- `scope` and `filters`;
- `evidence.included` and `evidence.excluded`, using permanent record identifiers;
- `requested.concepts` and `requested.relationships`;
- `resulting_claims`, whose origin and derivation metadata are explicit;
- `unresolved_or_contested`, including missing coverage rather than invented records;
- `answer_trace`, naming the methodology, version, inputs, and trace identifier.

All cross-record links use permanent `machine_id` values. Readable refs may be carried as display
context, but do not establish identity. A source-reported judgment uses `origin: source_reported`;
a Writ result uses `origin: writ_derived` and declares `methodology_id`, `methodology_version`,
`input_record_ids`, `trace_id`, and `writ_derived: true`.

The initial fixture is a saved view of the historical EU–US pilot question across the independent
EU and US corpora. It is an example of query composition, not a permanent product or corpus
identity.
