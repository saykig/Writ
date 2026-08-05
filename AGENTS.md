# AGENTS.md

## Mission

Build Writ as a structured, source-grounded knowledge system and domain-specific language for
political science and global affairs. It represents claims, institutions, laws, policies, theories,
empirical findings, evidence and relationships while preserving provenance, scope, uncertainty,
contestation and revision history. Questions are asked across corpora; they do not define corpora.

Optimize for semantic correctness, reproducibility, provenance, and reviewability before UI polish
or automation volume.

## Read first

Before changing core behavior, read:

- `docs/current/product-definition.md`;
- relevant current JSON Schemas;
- accepted ADRs that govern the affected behavior;
- the selected task in `TASKS.yaml`

Documents under `archive/` are historical evidence, never current instructions.

## Architectural invariants

1. Questions are query-layer objects, not corpus identities.
2. Jurisdictional corpora exist independently of comparisons.
3. The core schema does not require commitments, obligations, or scores.
4. External ratings are source-reported judgments.
5. Writ-derived results declare their methodology, version, inputs, and trace.
6. Unknown and contested values remain explicit; unknown is never silently treated as false.
7. Visualizations and memos are views, not sources of truth.
8. The implemented native families are `legal_policy` and `institutional`; future family
   identifiers remain extensible at the shared record base.
9. Deterministic derivation performs no network access, model inference, randomness, wall-clock
   reads, or mutation.
10. Models create candidates only. They never accept evidence, resolve disputes, waive diagnostics,
    or publish derived results.
11. Accepted records are superseded, not edited in place.
12. Exact decimals and explicit units are required for money and quantities.
13. Benchmark mismatches become discrepancy records, not hidden exceptions.
14. Stable diagnostic codes are never silently repurposed.

## Source of truth order

When specifications conflict:

1. this file's invariants;
2. `docs/current/product-definition.md`;
3. accepted ADRs and current JSON Schemas;
4. current protocol and language specifications;
5. current product documentation;
6. examples and compatibility material.

Open an ADR for any deliberate change to this order or the invariants.

## Commands

```bash
bun run format
bun run lint
bun run typecheck
bun run test
bun run conformance
bun run build
```

Do not change command names without updating this file and CI.

## Implementation rules

- Keep packages small and dependency direction one-way: domain and schemas -> evaluator/analyzer/compiler -> API/UI.
- Do not let API or database types become evaluator types.
- Use JSON Schema 2020-12 as interchange authority.
- Keep the shared provenance envelope small and put family-specific fields in family contracts.
- Do not force obligations, commitments, legal force, or scores onto every record.
- Keep source-reported judgments distinct from Writ-derived results.
- Add tests for every behavior change and diagnostic.
- Prefer pure functions in compiler, evaluator, analyzer, canonicalization, and proof code.
- Return typed errors and stable diagnostic codes.
- Do not add arbitrary JavaScript execution to the DSL.
- Do not introduce a graph database, workflow platform, or vector database without measured need and an ADR.
- Do not fetch live sites in normal unit tests.
- Redact secrets and restricted source content from logs and fixtures.

## Task discipline

Work on one task from `TASKS.yaml` at a time. Confirm dependencies, implement the smallest coherent slice, run its acceptance checks, update task status, and stop at the gate.

## Review priorities

Review in this order:

1. silent semantic change;
2. unknown-to-false collapse;
3. non-determinism;
4. incomplete proof dependencies;
5. schema drift;
6. authorization or provenance bypass;
7. corpus identity coupled to a query or comparison;
8. source-reported judgments presented as Writ facts;
9. missing tests;
10. maintainability.
