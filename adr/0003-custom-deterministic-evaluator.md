# Use a custom deterministic evaluator

Status: Accepted

## Decision

The canonical evaluator is a pure TypeScript implementation over normalized IR. Rego, Datalog, or CEL exports may be added, but none defines authoritative semantics.

## Consequences

The system needs proof DAGs, source-aware unknown handling, identity uncertainty, and stable receipts that generic policy engines do not provide directly.
