# ADR 0020: Deterministic, authority-traced pre-merge verification

**Status:** Accepted

## Context

Writ's schemas, accepted architecture decisions, Core contracts and scoped corpus contracts already
govern its representation. Repository checks were distributed across package tests and scripts, so a
change could satisfy local syntax while breaking cross-corpus identity, review history or generated
integrity. A semantic merge gate is useful only if it reads those decisions; it must not become a
shadow ontology.

## Decision

Writ has one read-only pre-merge verifier with four gates: ontology, interoperability, provenance and
integrity. It is deterministic, performs no network access, never repairs data, and exits successfully
only when every requested blocking gate passes. Every blocking invariant records its normative source.

Authoritative registered schemas under `schemas/` govern machine-readable vocabulary and structural
validity within each contract's scope. Accepted ADRs may add explicitly implemented semantic rules
that schemas intentionally do not encode. Manifest and corpus contracts apply only within their
declared scope. A domain helper is normative only when explicitly designated canonical and consistent
with the authoritative schema. Generated types, embedded schemas, vendored copies and convenience
interfaces are implementation aids, not independent authorities.

The verifier discovers schema identities from `schemas/` and selects processing adapters by exact
contract ID and declared version. The adapter registry describes verifier capability, not which
contracts Writ may create. It does not infer semantic-version compatibility. When an authoritative
contract identity is recognized but the exact declared version lacks verified support, the verifier
reports `VERIFIER_UNSUPPORTED_CONTRACT`. When genuinely normative sources conflict, it reports
`VERIFIER_AUTHORITY_CONFLICT` and stops for human architectural review.

ADR-backed constraints are ordinary reviewed code whose invariant metadata cites the ADR and section.
The verifier never interprets ADR prose dynamically. In particular, ADR 0019 supplies the endpoint,
ownership, inverse-link and review semantics for its six named cross-family relations; those semantics
are not generalized to other relation types.

Mechanical integrity covers paths, references, scoped counts, checksums, generated drift and declared
inventories. It does not impose semantic completeness. An institution need not have a mission,
mandate, function, capacity, placement or any other optional fact merely to satisfy integrity.

## Human and machine boundary

The machine answers whether a representation is structurally valid, internally resolvable and backed
by the review/evidence chain its governing contracts require. Human reviewers decide whether evidence
substantively justifies a political, legal or institutional interpretation. Passing the verifier never
converts internal consistency into substantive truth.

## No-weakening rule

If repository state violates a proposed blocking invariant, implementation must trace the rule to its
claimed authority. An unauthorized modeling preference is removed; an actual authority/repository
conflict is reported for human review. The verifier is not weakened and corpus content is not mutated
merely to obtain green CI.

## Consequences

- New invariants require an authority citation and deliberate verifier code.
- New valid contract versions may require a new adapter without changing Writ's ontology.
- Compatibility formats may continue using existing validators until a bounded semantic adapter is
  justified.
- General engineering checks remain separate from the semantic merge gate.
