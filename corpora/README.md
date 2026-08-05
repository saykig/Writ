# Active corpora

`corpora/` contains Writ's source-of-truth native corpora. The catalog at `corpora/catalog.yaml`
resolves stable corpus IDs to leaf paths and manifests; questions and topics do not determine
corpus identity.

The implemented families are:

- `legal-policy/<jurisdiction>/<issuing-authority>/<instrument-corpus>/` for legal instruments,
  policies, guidance, and dataset-backed legal collections;
- `institutional/<jurisdiction>/<root-institution>/` for atomic institutional facts.

Directories between a family/jurisdiction and a leaf corpus are organizational namespaces. Only
cataloged leaves are corpora. A legal-policy publication issued by NIST and an institutional fact
about NIST therefore live in different families and different source-of-truth files.

Legacy references may retain historical `ai-governance` strings, but no active corpus path or ID
uses that subject as its corpus boundary.

Each leaf manifest declares exactly one boundary — `instrument_id`, `instrument_series_id`,
`publication_id` or `dataset_collection_id` for legal policy, `root_institution_id` for
institutional — and one `record_contract` naming the contract its record files satisfy. The
boundary describes what the corpus actually captures; a corpus that registers a fact sheet or a
notice declares that publication rather than an underlying instrument it does not contain.

The retired subject-based corpus IDs are recorded once under `retired_corpus_migrations` in the
catalog. That mapping is historical and one-to-many, so it is not an alias table and a retired ID
never resolves to an active corpus.

Only native, family-governed corpora live here. The G7 and G20 compliance datasets are preserved
as frozen compatibility material under
[`archive/compatibility/`](../archive/compatibility/README.md) and are not catalogued.
