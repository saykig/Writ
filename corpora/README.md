# Active corpora

`corpora/` contains Writ's reviewed source-of-truth corpora. The catalog at
`corpora/catalog.yaml` resolves stable corpus IDs to leaf paths and manifests. Questions, topics,
comparisons, and development priority do not determine corpus identity.

The implemented families are:

- `legal-policy` for retained reviewed legal instruments and policies;
- `institutional/<jurisdiction>/<root-institution>/` for atomic institutional facts.

Directories between a family/jurisdiction and a leaf corpus are organizational namespaces. Only a
catalogued leaf is corpus material. NIST is the sole active development proving ground; the other
reviewed catalogued corpora are retained as secondary material.

Each leaf manifest declares exactly one boundary — `instrument_id`, `instrument_series_id`,
`publication_id` or `dataset_collection_id` for legal policy, `root_institution_id` for
institutional — and one `record_contract` naming the contract its record files satisfy. The
boundary describes what the corpus actually captures; a corpus that registers a fact sheet or a
notice declares that publication rather than an underlying instrument it does not contain.

`retired_corpus_migrations` preserves the historical one-to-many subject-corpus migrations. It is a
ledger, not an alias table.
