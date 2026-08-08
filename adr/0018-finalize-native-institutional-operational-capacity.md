# ADR 0018: Finalize native institutional operational capacity

Status: accepted

Date: 2026-08-05

## Context

The native v0.2 institutional schema introduced atomic fact records, but its provisional
`operational_capacity` payload exposed only `status`, free-form `dimensions`, and `evidence_refs`.
The repository contained no production native v0.2 operational-capacity record. The only uses of
that provisional shape were compatibility-v0.1 records and verification fixtures. NIST Stage A
explicitly omitted capacity pending reviewed evidence.

`VERSION_POLICY.md` requires semantic changes to be recorded and normally versioned. The Stage B
implementation specification permits an additive correction in the existing native contract when
no production operational-capacity record is invalidated. Compatibility consumers must continue to
work.

## Decision

Native institutional v0.2 keeps its existing contract and Writ-language version while completing
the previously unused capacity branch. A native capacity now requires one controlled `status`, one
controlled `capacity_type`, and `evidence_refs`; it may carry stable identifier-like
`capacity_components`, an `as_of_date`, and a controlled quantity. Any quantity requires an
`as_of_date`. `supranational_institution` is added to the native institution-type vocabulary.

The frozen v0.1 compatibility schema is unchanged. The parser retains a dedicated legacy capacity
syntax branch so active compatibility consumers continue to parse and lower the old
`status`/`dimensions` payload. Native v0.2 validation accepts only the finalized atomic payload.

This is a pre-production contract completion rather than a migration of published capacity data:
tests inventory every production institutional corpus before the change and prove that no native
operational-capacity record existed. Schema, domain types, compiler, formatter, protocol grammar,
vendored schema, embedded schema, and generated language artifacts move together.

## Consequences

- Capacity records can express institutional form without duplicating Core scope, evidence, or
  uncertainty.
- Function evidence alone remains insufficient for a capacity record.
- Dynamic quantitative observations are explicitly time-qualified.
- Existing Stage A records and frozen compatibility records are not rewritten.
- A future incompatible change after native capacity records are published requires a contract and
  language version bump under `VERSION_POLICY.md`.
