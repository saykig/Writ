# ADR 0017: Permanent corpus-family architecture

**Status:** Accepted

**Current note:** ADR 0023 narrows active development to NIST without retiring this decision's
catalogued corpus inventory, migration ledger, or generic two-family implementation. Existing
reviewed non-NIST corpora remain secondary material.

## Context

The first reviewed EU and US AI records were migrated into jurisdiction-and-topic directories.
That was a useful transitional boundary, but topic paths such as `ai-governance` do not remain
stable as an issuer publishes multiple instruments or as one passage supports different record
families. The Stage 1 institutional schema also models every institutional record as a complete
profile, and record judgments currently sit beside family extensions despite being analytical
objects.

## Decision

Writ initially implements two native record families: `legal_policy` and `institutional`. The
shared Core stays extensible so a future accepted ADR may add another family. A family defines the
kind of knowledge represented by a record; a corpus is a versioned, governed collection belonging
to exactly one family. Questions and topics do not classify corpora.

Native paths are family-first. Legal-policy corpora use an issuer-and-instrument hierarchy:

```text
corpora/legal-policy/<jurisdiction>/<issuing-authority>/<instrument-corpus>/
```

A subordinate publisher may add one namespace level. Intermediate issuer directories are
namespaces and never carry corpus manifests. Institutional corpora use:

```text
corpora/institutional/<jurisdiction>/<root-institution>/
```

Legal-policy paths based on subjects such as `ai-policy` or `ai-governance` are prohibited. The
same institutional name may occur in both families: an issuer namespace contains that issuer's
instruments, while an institutional corpus contains independently evidenced facts about the
institution.

The root `corpora/catalog.yaml` resolves stable corpus IDs to current paths. It lists native,
family-governed corpora only. Paths never determine identity. Each leaf manifest declares one
family and exactly one boundary: an instrument, an instrument series, a publication or a dataset
collection; each institutional manifest declares a root institution. The boundary must describe
what the corpus actually captures, so a corpus whose registered source is a fact sheet or notice
declares `publication_id` rather than claiming an underlying instrument it does not contain.

Every manifest also declares one `record_contract` naming the exact contract its record files
satisfy and whether that contract is `native` or `compatibility`. A corpus holding a preserved
imported payload declares the compatibility contract that validates it; it never advertises a
native family grammar its files cannot satisfy.

The two transitional corpus IDs `writ.corpus.eu.ai-governance` and `writ.corpus.us.ai-governance`
are retired and are not reused. Because each maps to several replacement corpora, they are recorded
once in a root-level `retired_corpus_migrations` ledger rather than repeated as leaf-level
`migration_aliases`: a one-to-many historical mapping cannot function as an ID-to-path alias, and
resolving one as an active corpus is an error. Their record-level legacy references remain
resolvable through the per-corpus migration ledgers.

Institutional v0.2 records are atomic facts discriminated as identity, placement, relationship,
mission, mandate, function, decision right or operational capacity. No fact type requires fields
belonging to another. A complete institutional profile is a derived view, not source truth.

Typed relationships use a family-neutral Core record-link contract. Links have independent
identity, evidence, uncertainty, provenance and review state, store one authoritative direction,
and may be targeted by analytical judgments. Record judgments are analysis-layer objects, not a
third family. Existing v0.1 record, institutional and judgment contracts remain versioned
compatibility inputs.

The G7 and G20 datasets are compliance-oriented compatibility material rather than a native family.
They are preserved byte-for-byte under `archive/compatibility/`, are absent from the catalog, and
have no native corpus manifest. Archived pilot material likewise remains outside this migration.

## Consequences

- The reviewed EU and US policy claims are partitioned by issuer and instrument without changing
  their identities, substantive values, evidence or review decisions.
- NIST publications and NIST institutional facts have intentionally different source-of-truth
  paths.
- A named institution does not acquire a mission, mandate, capacity or complete profile merely by
  appearing in a legal-policy record.
- Consumers use the catalog rather than hard-coded active corpus paths.
- Generated schemas and application data remain non-authoritative projections.
