# Schema authority

`schemas/` is the authoritative home for Writ JSON Schemas. Authoritative schemas use JSON Schema
2020-12.

## Layers

- `core/` contains shared record and provenance contracts.
- `extensions/` contains family-specific record contracts.
- `analysis/` contains review and mathematical-analysis contracts.
- `compatibility/` contains frozen formats kept for older data or tools.

Core schemas must not depend on higher layers.

## Current analysis schemas

- `record-judgment.schema.json` and `record-judgment-v0.3.schema.json` describe human review objects.
- `decision-case-v0.1.schema.json` describes the current narrow mathematical reference case.
- `decision-execution-v0.1.schema.json` describes a candidate result plus its recorded check.

The decision-case schemas are useful reference contracts, not the future engine-neutral decision
object. A new decision-object schema should be added only after the donor-tool comparison in the
current roadmap.

## Record families

The implemented native record families are `institutional` and `legal_policy`. Their specialized
fields live under `extensions/`; shared identity, evidence, uncertainty, and provenance stay in
`core/`.

## Rule for new schemas

Do not add a schema because a concept may be useful someday. Add it when a current operation needs a
stable interchange contract, include positive and negative fixtures, and document its layer and
dependency direction.
