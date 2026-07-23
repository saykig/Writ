# Canonical IR before surface syntax

Status: Accepted

## Decision

The canonical JSON representation, evaluator contracts, and schemas are the system of record. The textual DSL compiles into this IR.

## Consequences

This permits API ingestion, migration, tests, and alternate authoring interfaces without changing semantics. The grammar can evolve while the IR remains versioned.
