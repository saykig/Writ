# Covenant: G7 Compliance DSL Build Pack

Working name: **Covenant**. The name is provisional.

This repository pack is an implementation specification for an auditable system that converts G7 commitments, public evidence, and explicit interpretation rules into reproducible compliance evaluations.

The system is not merely a parser or a configurable scorecard. It has four core products:

1. A human-readable, source-linked domain-specific language for commitment methodology.
2. A canonical intermediate representation that is independent of syntax and evaluator implementation.
3. An immutable evidence ledger with source snapshots, passage anchors, claims, actions, reviews, and disputes.
4. A deterministic evaluation engine that emits proof-carrying receipts and reproducible reports.

## Start here

Read these files in order:

1. `00_EXECUTIVE_BRIEF.md`
2. `01_PRODUCT_REQUIREMENTS.md`
3. `02_DOMAIN_MODEL.md`
4. `03_LANGUAGE_SPEC.md`
5. `04_FORMAL_SEMANTICS.md`
6. `05_STATIC_ANALYSIS.md`
7. `06_DATA_SOURCES.md`
8. `07_INGESTION_PROVENANCE.md`
9. `08_SYSTEM_ARCHITECTURE.md`
10. `09_API_AND_UI.md`
11. `10_SECURITY_GOVERNANCE.md`
12. `11_TEST_AND_VALIDATION.md`
13. `12_IMPLEMENTATION_ROADMAP.md`
14. `13_CODEX_MASTER_PROMPT.md`
15. `14_DECISION_LOG.md`
16. `15_RESEARCH_SOURCES.md`
17. `16_LIBRARY_AND_STANDARDS_MATRIX.md`
18. `17_CORPUS_ENCODING_PLAYBOOK.md`
19. `18_DELIVERY_AND_ACCEPTANCE.md`

## What is included

- A complete product and architecture plan.
- A proposed DSL syntax and semantics.
- JSON Schemas for canonical IR, evidence, interpretation profiles, negative-evidence search protocols, source registry, methodology inventories, discrepancies, receipts, and releases.
- Complex examples based on several 2025 G7 compliance chapters.
- Fixtures for known methodology gaps and contradictions.
- A 103-entry source registry covering the G7 Research Group, G7 members, the European Union, international organizations, procurement, budgets, legislation, parliamentary records, official data, archives, and media.
- A sequenced Codex task graph with acceptance criteria.
- `AGENTS.md` and a repository skill for durable Codex guidance.
- A dependency-light TypeScript reference evaluator and bounded static analyzer.
- A production monorepo scaffold, OpenAPI planning contract, SQL migration, and architecture diagrams.

## Key principles

- **Judgment is explicit.** Facts, inferences, interpretations, classifications, and decisions are separate records.
- **Unknown is not false.** The evaluator uses four-valued evidence logic: true, false, unknown, and contested.
- **No score without a receipt.** Every result identifies the rule path, inputs, source snapshots, exclusions, unresolved claims, interpreter version, and content hashes.
- **No autonomous publication.** Language models may propose candidate facts and actions. They do not approve evidence, resolve disputes, or publish a final score.
- **History is immutable.** Corrections create new versions and releases rather than rewriting old states.
- **The IR precedes the syntax.** Build and test the domain model and evaluator before completing the parser.
- **Published methodology is testable.** The compiler must detect gaps, overlaps, unreachable rules, missing precedence, and inconsistency between prose guidance and formal score tables.

## Recommended execution order

Do not ask Codex to build the entire system in one task. Use `TASKS.yaml` or the prompts in `codex-tasks/` and merge one gate at a time.

The first meaningful milestone is not a web interface. It is a command that can:

```text
covenant compile examples/2025-ai-sme-resolved.covenant
covenant analyze examples/2025-ai-sme-resolved.covenant
covenant evaluate \
  --bundle build/2025-ai-sme.bundle.json \
  --evidence examples/2025-ai-sme.sample-evidence.json \
  --subject Canada \
  --as-of 2026-06-01
```

and emit a deterministic evaluation receipt.

## Validation status of this pack

Run `./scripts/validate_pack.sh` to validate the package. The JSON files and JSON Schemas are machine-validated. The dependency-light reference core is compiled and tested in this package. The Langium grammar is a bootstrap grammar and must be completed and validated during the language phase. URLs in the source registry are implementation leads and must be checked for current authentication, rate limits, licensing, and robots policies before a connector is enabled.

## Source basis

The design is based on the G7 Research Group compliance coding manual, historical compliance data pages, the 2025 final compliance report index, and several 2025 chapter methodologies that demonstrate different scoring structures. See `15_RESEARCH_SOURCES.md`.
