# `@writ/domain`

Canonical domain types, JSON Schema validation, stable identifiers, canonical serialization, and package hashes.

Keep public APIs small, versioned, and covered by conformance fixtures.

`validateVersion` resolves an explicitly requested `(kind, schema_version)` through the exact
schema registry and throws `UnsupportedSchemaVersionError` when that pair is not registered. It
never treats an unknown version as the current contract.
