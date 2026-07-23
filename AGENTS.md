# AGENTS.md

## Mission

Build Covenant as an auditable compliance-evaluation compiler and evidence system. Optimize for semantic correctness, reproducibility, provenance, and reviewability before UI polish or automation volume.

## Read first

Before changing core behavior, read:

- `04_FORMAL_SEMANTICS.md`
- relevant JSON Schemas in `specs/`
- `11_TEST_AND_VALIDATION.md`
- the selected task in `TASKS.yaml`

## Architectural invariants

1. The evaluator is deterministic and performs no network access, model inference, randomness, wall-clock reads, or mutation.
2. Truth values are `true`, `false`, `unknown`, and `contested`.
3. Unknown is never silently treated as false.
4. Models create candidates only. They never accept evidence, resolve disputes, waive diagnostics, or publish scores.
5. Every derived result can emit a proof node.
6. Every published score traces to a frozen methodology bundle and evidence snapshot.
7. Accepted records are superseded, not edited in place.
8. Counts use an explicit methodology identity policy.
9. Exact decimals and explicit units are required for money and quantities.
10. A benchmark mismatch becomes a discrepancy record, not a hidden exception.

## Source of truth order

When specifications conflict:

1. this file's invariants;
2. `04_FORMAL_SEMANTICS.md`;
3. JSON Schemas;
4. product requirements;
5. language surface syntax;
6. examples.

Open an ADR for any deliberate change to this order or the invariants.

## Commands

Until the production monorepo is bootstrapped:

```bash
cd reference-core
npm run build
npm test
```

After bootstrap, preserve root commands:

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run test:conformance
npm run test:integration
npm run covenant -- check examples
```

Do not change command names without updating this file and CI.

## Implementation rules

- Keep packages small and dependency direction one-way: domain and schemas -> evaluator/analyzer/compiler -> API/UI.
- Do not let API or database types become evaluator types.
- Use JSON Schema 2020-12 as interchange authority.
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
7. missing tests;
8. maintainability.
