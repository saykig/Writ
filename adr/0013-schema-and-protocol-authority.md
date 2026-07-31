# ADR 0013: Schema and protocol authority

**Status:** Accepted

## Context

Writ had two active-looking schema roots. `specs/` held the compiler/evaluator contracts, grammar,
and OpenAPI document, while `schemas/` held G7/G20 compliance-corpus contracts. The names obscured
which location was authoritative and made a domain-specific compatibility family look universal.

The current product definition requires a small shared core, family-specific extensions, and a
separate analysis layer. It also requires that commitment, obligation, and score fields not become
universal record requirements.

## Decision

`schemas/` is the only active JSON Schema authority:

- `schemas/core/` contains shared provenance and interchange contracts.
- `schemas/extensions/` is reserved for institutional, legal, policy, theoretical, and empirical
  family contracts.
- `schemas/analysis/` contains methodology, derived-result, trace, discrepancy, and release
  contracts.
- `schemas/compatibility/` contains versioned legacy and benchmark-specific contracts.

Language and API protocols live at `protocols/language/writ.ebnf` and
`protocols/api/openapi.yaml`.

Core may not depend on extensions, analysis, or compatibility. Extensions may depend on core.
Analysis may depend on core and explicitly named extensions. Compatibility families are isolated
and may remain consumed during migration, but they cannot become dependencies of new core or
extension contracts.

The G7/G20 summit-compliance version 2 schemas move unchanged except for `$id` and path. They remain
compatibility-only. The G7 methodology inventory is also compatibility-only. Commitment and score
constructs in the canonical IR are analysis-language constructs and do not define universal corpus
records.

The EU-US pilot schemas remain with the frozen pilot until its corpus migration. They are
pilot-local contracts, not global schema authority.

`packages/domain/schemas/` remains a runtime vendor directory. A drift test maps each vendored file
to its authoritative path under `schemas/`; generated TypeScript and embedded schema text continue
to derive from the vendor copies.

## Record ownership

Core owns source, passage, entity-envelope, claim, relationship-envelope, review, and corpus
manifest responsibilities. Family extensions own domain-specific payloads and source-reported
judgments. Analysis owns methodologies, derived results, proof dependencies, and traces.
Family-specific fields are not required globally.

## `reference-core`

The production evaluator/analyzer packages behaviorally supersede `reference-core`, and parity is
checked by `packages/conformance/test/canonical-parity.test.ts`. The reference package still has a
direct consumer through that test, plus root workspace and validation-script dependencies.
Therefore it is not deleted in this change. Its retirement requires replacing that dynamic import
with implementation-independent conformance fixtures, removing workspace/script dependencies, and
passing the same truth, score, witness, conformance, typecheck, and build gates.

## Consequences

- Schema consumers have one authoritative root.
- Compatibility contracts remain inspectable and versioned without shaping the universal core.
- Protocol paths communicate that EBNF and OpenAPI are not JSON Schemas.
- `$id` values change to match authoritative paths; schema payload semantics and versions do not.
- Future family schemas have explicit dependency constraints but are not designed by this ADR.
