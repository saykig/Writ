# Codex Master Prompt

Copy the prompt below into Codex from the repository root. Do not ask Codex to implement all phases in one unreviewed change. The prompt instructs it to execute the first unblocked task in `TASKS.yaml` and stop at the task gate.

---

You are implementing Writ, an auditable DSL and evidence system for G7 compliance evaluation.

Read, in this order:

1. `AGENTS.md`
2. `README.md`
3. `00_EXECUTIVE_BRIEF.md`
4. `01_PRODUCT_REQUIREMENTS.md`
5. `02_DOMAIN_MODEL.md`
6. `03_LANGUAGE_SPEC.md`
7. `04_FORMAL_SEMANTICS.md`
8. `05_STATIC_ANALYSIS.md`
9. `08_SYSTEM_ARCHITECTURE.md`
10. `11_TEST_AND_VALIDATION.md`
11. `12_IMPLEMENTATION_ROADMAP.md`
12. `TASKS.yaml`

Then inspect the repository and identify the first task whose dependencies are complete and whose status is `ready` or `todo`.

Before coding:

- restate the task objective in your work log;
- list the acceptance criteria you will verify;
- inspect adjacent schemas, examples, and fixtures;
- preserve the architectural invariants in `AGENTS.md`;
- do not introduce an alternate source of truth for schemas or semantics.

Implementation rules:

- Build the canonical IR and evaluator before completing the DSL parser.
- The evaluator must be deterministic and perform no network access, model inference, random generation, wall-clock reads, or database mutation.
- Preserve four-valued truth: `true`, `false`, `unknown`, and `contested`.
- Never collapse unknown to false unless a methodology explicitly declares a local closed-world rule.
- Every derived result must be able to produce a proof node.
- Use exact decimals for money and quantities.
- Keep model-assisted extraction outside the scoring core.
- Do not accept evidence or publish scores automatically.
- All behavior changes require tests.
- Do not weaken a test merely to make it pass.
- Do not add a custom evaluator plug-in for a benchmark methodology until the core rule algebra has been shown insufficient and an ADR is approved.

For the selected task:

1. Implement the smallest coherent vertical slice that satisfies its acceptance criteria.
2. Add unit, property, golden, or integration tests as appropriate.
3. Run all relevant checks.
4. Update generated files only through documented generation commands.
5. Update task status and add a concise completion note in `TASKS.yaml` only after tests pass.
6. Update an ADR when a material architectural choice changes.
7. Stop after the task gate. Do not begin the next phase in the same change.

Your final response must include:

- files changed;
- behavior implemented;
- tests and commands run;
- acceptance criteria status;
- unresolved risks or assumptions;
- the next unblocked task identifier.

If specifications conflict, follow this order:

1. `AGENTS.md` invariants
2. formal semantics
3. JSON Schemas
4. product requirements
5. language surface syntax
6. examples

Do not silently resolve a methodological ambiguity. Add a discrepancy or diagnostic fixture and surface it for human review.

---

## Suggested first Codex invocation

```text
Execute task CORE-001 from TASKS.yaml. Work only on that task and its direct prerequisites. Follow AGENTS.md. Run the complete reference-core validation before finishing.
```

## Suggested review invocation

```text
Review the current diff against the task acceptance criteria, AGENTS.md invariants, formal semantics, and schemas. Focus on correctness defects, silent unknown-to-false conversions, non-determinism, missing proof dependencies, schema drift, and inadequate tests. Do not propose cosmetic changes unless they affect maintainability or auditability.
```
