# Start Here

Writ is a structured, source-grounded knowledge system and domain-specific language for political
science and global affairs. It represents claims, institutions, laws, policies, theories, empirical
findings, evidence and relationships while preserving provenance, scope, uncertainty, contestation
and revision history. Questions are asked across corpora; they do not define corpora.

Read these before changing the repository:

1. `AGENTS.md` for implementation invariants and working rules.
2. `docs/current/product-definition.md` for current product scope.
3. `TASKS.yaml` for the active change and acceptance gate.
4. Relevant current schemas and accepted ADRs.
5. `docs/current/repository-structure.md` before relocating existing material.

## What is normative

Use this precedence order when documents disagree:

1. `AGENTS.md` invariants, unless an accepted replacement ADR explicitly supersedes one.
2. `docs/current/product-definition.md`.
3. Accepted ADRs and current JSON Schemas.
4. Current protocol and language specifications.
5. Current product and task documents.
6. Examples and compatibility material.

Material under `archive/` is historical and non-normative.

## Working principles

- Keep jurisdictional corpora independent of comparisons and saved questions.
- Keep institutional, legal, policy, theoretical, and empirical records family-specific.
- Preserve unknown and contested values rather than coercing them.
- Treat external ratings as source-reported judgments.
- Make every Writ-derived result reproducible from named, versioned inputs and a trace.
- Treat visualizations and memos as views, never as source records.
- Supersede accepted records instead of silently rewriting them.

## Evidence warning

`config/source_registry.yml` contains connector candidates and research leads.
`data/source-registry.json` is its generated compatibility projection. A source's
`verification_status` is authoritative for operational readiness. Codex must not treat an entry
as production-ready merely because it appears in the registry.
