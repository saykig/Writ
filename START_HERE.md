# Start Here: Codex Handoff

This pack is a build specification for **Writ**, a domain-specific language and evidence system for auditable G7 commitment compliance evaluation.

## The first command to give Codex

Open `13_CODEX_MASTER_PROMPT.md` and use it as the initial task prompt in a fresh repository. Keep `AGENTS.md`, `TASKS.yaml`, `.agents/skills/writ-domain/SKILL.md`, `specs/`, `examples/`, and `fixtures/` at the repository root.

## What is normative

Use this precedence order when documents disagree:

1. `AGENTS.md` invariants, unless an accepted replacement ADR explicitly supersedes one.
2. `04_FORMAL_SEMANTICS.md` and accepted ADRs.
3. JSON Schemas in `specs/`.
4. `02_DOMAIN_MODEL.md` and `03_LANGUAGE_SPEC.md`.
5. Product, architecture, roadmap, and task documents.
6. Examples and the bootstrap Langium grammar.

The bootstrap grammar is not complete. Do not contort the domain model to preserve it.

## First delivery slice

Build a vertical slice that can:

1. validate the canonical IR and evidence fixtures;
2. evaluate a precomputed fact environment using four-valued truth;
3. emit a deterministic evaluation receipt;
4. lint the literal AI-for-SMEs score program and find its gap and overlap;
5. evaluate the resolved interpretation profile without either defect;
6. expose the same behavior through a CLI and API;
7. render the receipt and its proof tree in a minimal review UI.

Do not begin with broad web crawling, a polished editor, or LLM extraction. Those become valuable only after the semantic core is trustworthy.

## Definition of a serious first milestone

The first milestone is complete only when:

- all JSON examples validate against their schemas;
- the conformance suite is deterministic on two clean runs;
- score gaps and overlaps include minimized witnesses;
- unknown evidence never silently becomes false;
- action identity uncertainty can block or widen counts;
- every result names the methodology, evidence, interpretation, and evaluator hashes that produced it;
- the repository contains a migration path and rollback notes for every schema change.

## Evidence warning

`data/source-registry.json` contains connector candidates and research leads. Its `verification_status` field is authoritative for operational readiness. Codex must not treat an entry as production-ready merely because it appears in the registry.
