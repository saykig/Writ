# ADR 0020: Deterministic, authority-traced Writ verification

**Status:** Accepted; ADR 0023 retires the ADR-0019 rule pack

## Context

Writ's schemas, accepted architecture decisions, Core contracts and scoped corpus contracts already
govern its representation. Repository checks were distributed across package tests and scripts, so a
change could satisfy local syntax while breaking cross-corpus identity, review history or generated
integrity. A verification instrument is useful only when it reads those decisions; it must not become
a shadow ontology or a decision-maker.

## Decision

Writ provides a **Writ Verification Harness** with four verification dimensions: ontology,
interoperability, provenance and integrity. The harness is read-only and deterministic. It performs
no network access, does not repair or rewrite input, and does not create, clean or mutate the
filesystem/worktree supplied as its verification workspace.

The harness reports machine-detectable compatibility findings under the authoritative contracts and
exact adapters it supports. A non-zero exit status means findings exist. Neither a zero nor non-zero
exit status accepts evidence, approves records, authorizes a merge or decides whether a change should
be accepted. Those decisions remain human responsibilities.

> The harness reports whether a proposed representation is compatible with the Writ contracts it
> understands. It does not decide whether that representation should become part of Writ.

Authoritative registered schemas under `schemas/` govern machine-readable vocabulary and structural
validity within each contract's scope. Accepted ADRs may add explicitly implemented semantic rules
that schemas intentionally do not encode. Manifest and corpus contracts apply only within their
declared scope. A domain helper is normative only when explicitly designated canonical and consistent
with the authoritative schema. Generated types, embedded schemas, vendored copies and convenience
interfaces are implementation aids, not independent authorities.

The harness discovers schema identities from `schemas/` and selects processing adapters by exact
contract ID and declared version. The adapter registry describes harness capability, not which
contracts Writ may create. It does not infer semantic-version compatibility. When an authoritative
contract identity is recognized but the exact declared version lacks verified support, the harness
reports `VERIFIER_UNSUPPORTED_CONTRACT`. When genuinely normative sources conflict, it reports
`VERIFIER_AUTHORITY_CONFLICT` for human architectural review.

The stable kernel orchestrates verification and reporting without a closed list of corpus families.
Family values remain strings governed in their applicable schema scope. Current Writ adapters handle
the exact contracts implemented today, and scoped rule packs implement accepted semantic decisions.
Future contracts, families and versions can add exact adapters or rule packs without changing the
kernel or being predeclared as members of a harness-owned ontology.

ADR-backed constraints are reviewed code whose invariant metadata cites the ADR and section. The
harness never interprets ADR prose dynamically. ADR 0023 removes the former ADR-0019 cross-family
rule pack and workflow adapter because the current development direction no longer depends on that
specialized workflow. The reviewed corpora and links remain available under their generic contracts
and corpus tests.

Mechanical integrity covers paths, references, scoped counts, checksums, generated drift and declared
inventories. It does not impose semantic completeness. An institution need not have a mission,
mandate, function, capacity, placement or any other optional fact merely to satisfy integrity.

## Human and machine boundary

The machine can establish that, under supported authoritative contracts and adapters, it found no
machine-detectable incompatibilities. It cannot establish substantive truth, legal or political
correctness, evidentiary sufficiency, completeness, human approval, acceptance, or whether a change
should be merged.

`PASS` means only that the selected dimensions found no machine-detectable incompatibilities under
the supported authoritative contracts and exact adapters. `FAIL` means findings exist. Human review
determines acceptance.

The machine question is: “Does this representation satisfy the applicable machine-checkable
contracts?” The human question is: “Should we accept this representation and its interpretation?”

## No-weakening rule

If repository state violates a proposed finding rule, implementation must trace the rule to its
claimed authority. An unauthorized modeling preference is removed; an actual authority/repository
conflict is reported for human review. The rule is not weakened and corpus content is not mutated
merely to obtain a passing result.

## Consequences

- New fail-closed invariants require an authority citation and deliberate harness code.
- New valid contract versions may require a new exact adapter without changing Writ's ontology.
- Compatibility formats may continue using existing validators until a bounded semantic adapter is
  justified.
- The harness can run in automation, but its result remains an instrument output rather than an
  acceptance or merge decision.
- General engineering checks remain separate from Writ verification.
