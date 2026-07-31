# Implement the canonical domain layer

## Instruction

Implement stable identifiers, JSON Schema 2020-12 validation with AJV, generated TypeScript types, semantic version fields, canonical JSON serialization compatible with RFC 8785, SHA-256 hashing, and schema migrations. Validate every checked-in JSON example.

Acceptance: invalid fields fail closed; canonicalization is byte-stable; schema and generated types cannot drift in CI; old fixtures have explicit migrations rather than silent coercion.

## Non-goals

Do not redesign settled ADRs without opening a replacement ADR. Do not add broad infrastructure that is not required by the acceptance criteria. Do not hide incomplete behavior behind mocks in production paths.
