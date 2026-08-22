# ADR 0023: Establish NIST as the sole active development proving ground

**Status:** Accepted

## Context

The foundation reset narrowed Writ to inspectable, evidence-bound political knowledge records, but
source-specific ingestion adapters, archived compatibility consumers, and the verification harness
still encoded an active EU–US/G20 product direction. ADR 0019 also kept a specialized cross-family
queue and rule pack active after that workflow ceased to drive current development.

## Decision

NIST is Writ's sole active development proving ground. Active work focuses on source-bound
institutional records that preserve identity, placement, mission, mandate, function, decision
right, operational capacity, human review, and provenance without overclaiming.

Existing reviewed European Commission and legal-policy corpora remain catalogued as secondary
material. Their source bytes, records, reviews, provenance, declared compatibility contracts,
deterministic data-bundle projection, and generic verification remain intact. Catalog lifecycle
status does not designate which corpus drives the development roadmap.

Questions and human reasoning remain external to Writ. Source-specific G20, EU–US migration, and
constitutional import runtimes are retired when no current workflow requires them. The ADR-0019
mapping queue, workflow adapter, and specialized verifier rule pack are retired from active code;
the reviewed cross-family records remain preserved and covered by corpus and generic contract
tests.

The generic `legal_policy` schema, grammar, family implementation, and frozen v0.1 record contracts
remain implemented. Having an implemented family or retained corpus does not require it to drive
active development. Family retirement or redesign is a separate decision.

Obsolete compliance runtime directions remain recoverable through Git history. Historical material
under `archive/` and `docs/migrations/` is non-authoritative and has no active runtime, bundle, or
verifier consumer.

## Consequences

- `corpora/catalog.yaml` retains the reviewed native corpus inventory; NIST alone drives active
  development.
- No European Commission institutional or legal-policy corpus tree is removed.
- The data bundle continues to export every manifest-routed retained record, link, judgment, and
  provenance object.
- The verifier retains generic catalog, manifest, reference, judgment, migration, and checksum
  checks, but registers no ADR-0019 workflow or rule pack.
- Future active analysis or interoperability capabilities must earn their way back through
  demonstrated need and an accepted decision; retaining reviewed material does not reactivate a
  product direction.
- Substantive corpus records and source bytes are unchanged.
