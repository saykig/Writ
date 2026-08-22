# AGENTS.md

## Mission

Build Writ as a source-grounded knowledge system that makes political knowledge more inspectable,
reviewable, provenance-preserving, and easier for humans to reason from without replacing human
judgment. The current proving ground is the NIST institutional corpus, and the immediate system
boundary is source -> passage -> typed record -> human review -> provenance.

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

1. Corpora and records exist independently of questions, comparisons, analyses, and presentation
   layers.
2. Human reasoning remains external to Writ. Questions are not first-class Writ objects.
3. The immediate system boundary is source -> passage -> typed record -> human review ->
   provenance.
4. Institutional records distinguish identity, placement, mission, mandate, function, decision
   right, and operational capacity without inferring one from another.
5. The core schema does not require commitments, obligations, or scores.
6. External ratings are source-reported judgments.
7. Unknown and contested values remain explicit; unknown is never silently treated as false.
8. Visualizations and memos are views, not sources of truth.
9. The implemented native families are `legal_policy` and `institutional`; future family
   identifiers remain extensible at the shared record base.
10. Deterministic compilation and verification perform no network access, model inference, randomness, wall-clock
   reads, or mutation.
11. Models create candidates only. They never accept evidence, resolve disputes, waive diagnostics,
    or publish derived results.
12. Accepted records are superseded, not edited in place.
13. Exact decimals and explicit units are required for money and quantities.
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
bun run data:check
bun run verify:writ
bun run build
```

Do not change command names without updating this file and CI.

## Implementation rules

- Keep packages small and dependency direction one-way: domain and schemas -> language/provenance/data export -> API/UI.
- Do not let API or database types become native record types.
- Use JSON Schema 2020-12 as interchange authority.
- Keep the shared provenance envelope small and put family-specific fields in family contracts.
- Do not force obligations, commitments, legal force, or scores onto every record.
- Keep source-reported judgments distinct from Writ records.
- Add tests for every behavior change and diagnostic.
- Prefer pure functions in compilation, canonicalization, validation, and verification code.
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
7. record or corpus identity coupled to a question, comparison, analysis, or presentation;
8. source-reported judgments presented as Writ facts;
9. missing tests;
10. maintainability.
