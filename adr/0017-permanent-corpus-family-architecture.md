# ADR 0017: Permanent corpus-family architecture

**Status:** Accepted

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

The root `corpora/catalog.yaml` resolves stable corpus IDs to current paths. Paths never determine
identity. Each leaf manifest declares one family and either an instrument, instrument series or
dataset collection; each institutional manifest declares a root institution. The two transitional
corpus IDs `writ.corpus.eu.ai-governance` and `writ.corpus.us.ai-governance` are retired and are not
reused. Their record-level legacy references remain resolvable through migration ledgers.

Institutional v0.2 records are atomic facts discriminated as identity, placement, relationship,
mission, mandate, function, decision right or operational capacity. No fact type requires fields
belonging to another. A complete institutional profile is a derived view, not source truth.

Typed relationships use a family-neutral Core record-link contract. Links have independent
identity, evidence, uncertainty, provenance and review state, store one authoritative direction,
and may be targeted by analytical judgments. Record judgments are analysis-layer objects, not a
third family. Existing v0.1 record, institutional and judgment contracts remain versioned
compatibility inputs.

G7/G20 compatibility corpora and archived pilot material remain outside this native migration.

## Consequences

- The reviewed EU and US policy claims are partitioned by issuer and instrument without changing
  their identities, substantive values, evidence or review decisions.
- NIST publications and NIST institutional facts have intentionally different source-of-truth
  paths.
- A named institution does not acquire a mission, mandate, capacity or complete profile merely by
  appearing in a legal-policy record.
- Consumers use the catalog rather than hard-coded active corpus paths.
- Generated schemas and application data remain non-authoritative projections.
