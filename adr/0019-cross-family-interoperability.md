# ADR 0019: Cross-family interoperability through institution-owned Core links

**Status:** Accepted

## Context

Legal-policy records already name institutions, while independently reviewed institutional corpora
hold the canonical identities and facts about those institutions. Repeating institution objects in
every legal-policy corpus would create competing identities. Treating corpus paths, publisher labels,
or broad actor classes as resolved institutions would instead turn unreviewed assumptions into graph
edges.

The Core record-link contract already provides directed relationships, evidence basis, supporting
records, uncertainty, provenance, and workflow state. A third corpus family or another relationship
schema is therefore unnecessary.

## Decision

Cross-family links are Core record-link objects stored by the institutional corpus that owns the
canonical institutional endpoint. `owning_corpus_id` identifies the storage and provenance owner of
the relationship. It does not assert that the owning corpus contains `source_id`. A legal-policy
record may be the source endpoint while its link is stored with the target institution.

The endpoint contract is:

| Relation | Source endpoint | Target endpoint |
| --- | --- | --- |
| `issued_by` | publication/source document or instrument | institution |
| `assigns_function_to` | legal-policy claim or provision | institution |
| `implemented_by` | legal-policy claim or provision | institution |
| `enforced_by` | legal-policy claim or provision | institution |
| `applies_to` | legal-policy claim or provision | institution |
| `derives_authority_from` | institutional mandate, decision-right, or function record | legal-policy provision record |

Source documents, claims, corpus IDs, and provision records are not interchangeable endpoints.
`derives_authority_from` retains its institutional-to-provision direction even though other relations
in this first layer point from legal-policy objects to institutions.

An institutional endpoint resolves only when the schema-backed catalog locates an institutional
corpus and exactly one approved atomic identity record has the requested `institution_id`. A manifest
`root_institution_id` helps locate a candidate corpus but is not identity evidence. Zero approved
identity matches and multiple approved identity matches are deterministic errors.

`direct`, `inherited`, and `inferred` remain evidence bases. Unresolved is a mapping workflow status,
not an evidence basis. An inherited link must identify the records supporting every inherited step.
Unresolved mappings remain in a review queue outside active corpus manifests.

Every link has its own review state and disposition judgment. Approval of either endpoint or a
supporting record never transfers to the link. Automated proposals begin as draft links with proposed
judgments; a subsequent human decision may approve the link and supersede, but never erase, its
proposal judgment.

Reverse traversal is derived from the one stored direction. Inverse duplicate links are prohibited.

## Initial bounded implementation

The first implementation contains only three directly evidenced, human-approved
`assigns_function_to` links from AI Act claims to `eu_ai_office`. Sara Kim completed the independent
review on 2026-08-08; the decisions and preserved automated proposal history are recorded in
`docs/migrations/cross-family-interoperability/human-review.yaml`. These examples prove cross-family
storage, endpoint resolution, evidence traceability, and independent review without attempting broad
relationship population. The America’s
AI Action Plan recommendation involving NIST remains unresolved because a recommended policy action
does not by itself establish the stronger assignment relation.

That human review also approved an identifier-only migration from
`eu_ai_office_technical_documentation_receipt` to `eu_ai_office_tech_doc_receipt`. The migration
changes no assertion, evidence, classification, scope, uncertainty, review decision or provenance.

Publisher metadata is not automatically issuer evidence. Broad classes such as “covered agencies” do
not establish application to NIST without a complete, time-qualified membership chain. Authority links
must target provision records rather than whole-document containers. These and all source-recovery or
new-identity questions are deferred.

## Consequences

- Future legal-policy corpora reuse a reviewed institutional ID instead of creating local duplicates.
- Institution-owned link storage can cite legal-policy endpoints without changing compatibility-formatted
  legal-policy corpora.
- The graph remains sparse until evidence and human review support each edge.
- The existing stale TypeScript `CorpusCatalog.corpora` interface is not used or corrected here; this
  implementation consumes the schema-backed `native_corpora` representation through a narrow resolver
  input.
