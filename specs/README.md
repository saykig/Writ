# Contract schemas

These JSON Schemas are the external contracts for Writ version 1 planning artifacts.

Normative principles:

1. JSON Schema draft 2020-12 is the interchange authority.
2. Generated language types are conveniences and must be checked for drift.
3. Additional properties are rejected on governed objects unless a schema explicitly permits extension metadata.
4. Semantic migrations are explicit and versioned.
5. Canonical hashes are computed after schema validation and RFC 8785-compatible canonicalization.

Included contracts:

- `canonical-ir.schema.json`: normalized methodology program.
- `evidence.schema.json`: source versions, passages, claims, actions, and reviews.
- `evaluation-receipt.schema.json`: deterministic result and proof dependencies.
- `interpretation-profile.schema.json`: explicit resolutions of ambiguous methodology choices.
- `search-protocol.schema.json`: evidence coverage required for negative claims.
- `methodology-inventory.schema.json`: analyst extraction worksheet before formal encoding.
- `source-registry.schema.json`: connector policy and readiness.
- `discrepancy.schema.json`: benchmark differences and methodological defects.
- `release.schema.json`: signed, reproducible publication manifest.
- `openapi.yaml`: planning contract for governed API resources and commands.
