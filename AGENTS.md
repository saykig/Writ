# AGENTS.md

## Mission

Build Writ as infrastructure for making consequential decision-making more inspectable, cumulative,
and correctable without replacing human or institutional judgment.

Writ currently has two deliberately separate surfaces:

1. a source-grounded knowledge layer: source -> passage -> typed record -> human review -> provenance;
2. a bounded derived decision layer: explicit problem/question + assumptions/model + exact execution ->
   independent check -> applicability -> human disposition -> revision/reuse.

The first surface preserves what is known and why. The second preserves what follows from an explicit
mathematical subject and when that result may be reused. Neither surface may silently supply the
premises, authority, or empirical truth required by the other.

Bellman is the mathematical research programme that establishes the semantics and guarantees Writ
will progressively make executable. Writ should implement stable Bellman slices without turning the
current implementation language, backend, or first synthetic cases into the mathematical ceiling.

Optimize for semantic correctness, reproducibility, provenance, explicit uncertainty, and
reviewability before UI polish or automation volume.

## Read first

Before changing core behavior, read:

- `docs/current/product-definition.md`;
- `docs/current/roadmap.md`;
- relevant current JSON Schemas;
- accepted ADRs that govern the affected behavior;
- the selected task in `TASKS.yaml` when one exists.

Git-tagged snapshots indexed by `docs/history/snapshots.md` and documents under `docs/migrations/`
are historical evidence, not current instructions.

## Architectural invariants

1. Sources, passages, reviewed records, and corpus identity do not derive their truth or identity from
   a downstream question, model, analysis, visualization, or recommendation.
2. Derived decision cases may be first-class Writ artifacts, but they remain separate from native
   political-knowledge records and cannot rewrite their evidence or review status.
3. Preserve the distinction among source evidence, interpretation, modelling assumptions,
   mathematical subject, computed result, independent check, applicability, human disposition, and
   authority to act.
4. A checked mathematical result is conditional on the exact model/problem, query, information
   access, policy/action class, units, assumptions, and guarantee type that justify it.
5. A result may be historically correct under old premises while becoming inapplicable after a
   revision. Preserve the old statement and record the changed dependency rather than rewriting
   history.
6. Compatible, incompatible, and compatibility-not-established/unresolved are distinct states.
   Unknown is never silently treated as false; nonidentification is not a tie.
7. Bellman mathematical semantics govern mature decision primitives. Writ may encode, compute,
   check, version, compose, reuse, and correct them, but must not weaken their assumptions or invent
   missing mathematics at an interface.
8. NIST remains the active proving ground for the source-grounded institutional-knowledge layer.
   Synthetic decision cases are a separate engineering proving ground for mathematical integration;
   NIST does not define the entire Writ roadmap.
9. The implemented native record families are `legal_policy` and `institutional`; family-specific
   semantics remain outside the shared provenance envelope.
10. External ratings and source-reported judgments remain statements of their identified sources,
    not Writ facts merely because Writ preserves them.
11. Accepted native records are superseded, not edited in place. Derived case revisions and checked
    executions likewise remain immutable historical snapshots.
12. Pure compilation, identity, validation, and verification are deterministic over frozen inputs.
    External process execution belongs only to explicit runners with fixed, validated boundaries;
    data never supplies arbitrary executable commands.
13. Models and solvers may produce candidates. They do not accept evidence, resolve disputes, invent
    authority, waive diagnostics, or turn a mathematical optimum into permission to act.
14. Exact quantities retain explicit units and exact representations where the governed mathematics
    requires them. Do not silently round exact mathematical inputs through JavaScript numbers.
15. The current Python/TypeScript implementation is a reference implementation, not a permanent
    language commitment. Revisit Julia/optimization backends, Rust exact checking, or Lean formal
    proof only when the concrete capability reaches the corresponding need.
16. Do not introduce a universal ontology, graph database, workflow platform, vector database,
    general solver registry, or autonomous policy system without measured need and an accepted ADR.

## Source of truth order

When specifications conflict:

1. this file's invariants;
2. `docs/current/product-definition.md`;
3. accepted ADRs and current JSON Schemas;
4. `docs/current/roadmap.md` for current sequencing, never as permission to bypass an ADR;
5. current protocol, language, and technical documentation;
6. examples, experiments, compatibility material, and historical records.

A roadmap item is a direction, not authorization to change an accepted semantic contract. Open or
update an ADR when a durable architectural decision needs to supersede an earlier accepted one.

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

Run additional package-specific or integration gates required by the affected capability. Do not
report an integration as passing when its real backend check was skipped.

## Implementation rules

- Keep packages small and dependency direction explicit.
- Do not let API/database types become native knowledge or decision-case authority.
- Use JSON Schema 2020-12 as interchange authority where a JSON contract is declared.
- Keep source grounding, modelling, mathematical checking, applicability, review, and authority
  separable in code as well as documentation.
- Preserve exact source bytes and mathematical bytes at the boundary that claims to bind them.
- Add decisive positive and negative tests for every semantic behavior change.
- Prefer pure functions for compilation, canonicalization, validation, identity, and checking.
- Return typed failures and stable diagnostic codes.
- Do not add arbitrary JavaScript execution to the Writ language.
- Do not fetch live sites in normal deterministic tests.
- Redact secrets and restricted source content from logs and fixtures.
- Do not duplicate Bellman proofs into Writ merely to make them look native; implement stable
  semantics through a narrow, checkable interface.

## Task discipline

Use `docs/current/roadmap.md` to understand direction. Use `TASKS.yaml` as an execution ledger, not as
an eternal product roadmap. Work on the smallest coherent task that advances a current roadmap gate,
confirm dependencies, run its acceptance checks, update durable documentation only when the result
changes current understanding, and stop at the gate.

Version history lives under `docs/history/releases/`. Meaningful releases summarize completed
transitions and preserve failures and retirements as well as surviving work; do not release after
every PR. Published version tags are immutable, and release publication requires explicit human
authorization.

## Review priorities

Review in this order:

1. silent semantic change or invalid mathematical composition;
2. result reuse outside its assumptions, information context, units, or intended query;
3. source/evidence/model/analysis conflation;
4. unknown-to-false, unresolved-to-incompatible, or interval-overlap-to-tie collapse;
5. stale or incomplete dependency/revision handling;
6. non-determinism or unchecked executed code at a claimed pinned boundary;
7. schema or protocol drift;
8. authorization, human-review, or provenance bypass;
9. corpus/record identity coupled to a downstream analysis;
10. missing decisive tests and maintainability.

Promote durable knowledge in the order test > invariant > accepted ADR/current doc > local reminder.
Do not preserve one-off reviewer personas or experimental agent roles after their lessons have been
captured by stronger repository protections.
