# Compliance corpus schemas

The corpus interchange contracts use JSON Schema 2020-12. Version `2.0.0` is a breaking migration
from the Phase 1A draft:

- commitments no longer carry selection or score placeholders;
- selection, report, member assessment, reconciliation, and review items are separate records;
- published and Writ-computed result vocabularies are closed and separate;
- report stages are `preliminary`, `interim`, `final`, and `special`;
- record identity and selection eligibility are enforced by graph validation.

Phase 1A `1.0.0` artifacts, if published after the offline validation gate, remain immutable
historical objects in the content-addressed store. A consumer rolls back by continuing to read those
prior object hashes; the migration never rewrites them. New consumers must reject mixed v1/v2
normalized graphs and migrate the whole graph through a source-specific adapter.

JSON Schema validates individual records. Cross-record requirements—uniqueness, reconciliation,
selection eligibility, report supersession, vocabulary review, and passage/source references—are
enforced by `writ_ingest.corpus.validation`.
