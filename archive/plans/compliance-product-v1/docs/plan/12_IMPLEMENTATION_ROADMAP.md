# Implementation Roadmap

This roadmap is gate-based rather than calendar-based. Do not advance because a phase feels complete. Advance when its acceptance gate passes.

## Phase 0: Corpus and methodology benchmark

### Goal

Create the evidence needed to design the language from real methodological variety.

### Deliverables

- local mirror or indexed references for the coding manual, 2025 report index, 20 chapters, and published score matrix;
- structured inventory of each chapter's definitions, classifications, dimensions, exclusions, and score table;
- methodology-shape taxonomy;
- discrepancy fixtures for known gaps and contradictions;
- stable identifiers for 20 commitments and eight members.

### Tasks

1. Build the G7 corpus downloader and manifest.
2. Extract chapter text and page geometry.
3. Manually verify score tables and complex figures.
4. Create one methodology inventory JSON per chapter.
5. Record every distinct rule construct required.
6. Select the seven-methodology diversity set.

### Gate

A methodologist can point to every proposed core language construct and show at least one chapter requiring it.

## Phase 1: Canonical domain and schemas

### Goal

Define the system of record before parser syntax.

### Deliverables

- canonical IR JSON Schema;
- evidence, source registry, receipt, discrepancy, and release schemas;
- TypeScript generated types;
- schema validation CLI;
- versioning and migration policy;
- sample valid and invalid fixtures.

### Tasks

1. Implement schema package.
2. Generate TypeScript types.
3. Add AJV validators.
4. Add canonical JSON serializer.
5. Add schema compatibility tests.
6. Validate all examples in this pack.

### Gate

All checked-in data validates; invalid fixtures fail predictably; canonical hashes are stable.

## Phase 2: Deterministic evaluator

### Goal

Evaluate hand-authored IR and emit proof receipts.

### Deliverables

- four-valued truth module;
- expression interpreter;
- exact count and count-interval logic;
- classification engine;
- score branch selector;
- proof tree;
- canonical receipt and hash;
- CLI for evaluation.

### Tasks

1. Implement truth algebra.
2. Implement typed scalar expressions.
3. Implement finite queries over actions.
4. Implement identity and deduplication policies.
5. Implement classification priority.
6. Implement score selection and unresolved results.
7. Implement proof serialization.
8. Add conformance tests.

### Gate

The evaluator passes the conformance suite and produces deterministic receipts for hand-authored examples.

## Phase 3: Static analyzer

### Goal

Detect methodological defects before evaluation.

### Deliverables

- normalized condition model;
- diagnostic framework;
- Z3 lowering for finite domains;
- overlap, exhaustiveness, reachability, and monotonicity checks;
- human-readable witnesses;
- CI command.

### Tasks

1. Implement non-SMT lint rules.
2. Implement finite-domain declarations.
3. Lower integer, Boolean, enum, set-cardinality, and artifact-presence constraints to Z3.
4. Minimize counterexamples.
5. Add fixture tests.
6. Implement waiver records.

### Gate

The analyzer catches every seeded fixture, including both operationalizations of “up to four strong actions” in the AI-for-SMEs chapter and the counteraction overlap.

## Phase 4: Language compiler and editor tooling

### Goal

Author methodology in a readable DSL that compiles to the proven IR.

### Deliverables

- Langium grammar;
- AST types;
- linker and type checker;
- AST-to-IR compiler;
- formatter;
- source maps;
- literate Markdown support;
- LSP;
- Monaco integration;
- VS Code extension optional.

### Tasks

1. Stabilize syntax from the IR and examples.
2. Implement imports and lock file.
3. Implement definitions, predicates, classifications, queries, score blocks, profiles, assertions, and scenarios.
4. Lower syntactic sugar to core IR.
5. Add code actions for common diagnostics.
6. Parse and compile the diversity set.

### Gate

All diversity-set methodologies compile without evaluator plug-ins, format idempotently, and produce the same IR as golden fixtures.

## Phase 5: Full 2025 methodology encoding

### Goal

Encode all selected 2025 commitments before building broad automation.

### Deliverables

- 20 methodology packages;
- methodology source maps;
- scenario tests;
- benchmark score-table import;
- discrepancy ledger.

### Tasks

1. Encode each chapter.
2. Run static analysis.
3. Resolve or waive diagnostics.
4. Add chapter-specific scenarios.
5. Review cross-commitment consistency.
6. Version and sign methodology bundles.

### Gate

All 20 packages compile, analyze, and pass methodologist review.

## Phase 6: Evidence ledger and review API

### Goal

Create governed evidence records that can drive the evaluator.

### Deliverables

- PostgreSQL schema and migrations;
- document, passage, claim, action, review, relationship, and snapshot APIs;
- append-only audit events;
- optimistic concurrency;
- source and evidence permissions;
- evidence export for the evaluator.

### Tasks

1. Implement core database tables.
2. Implement command-style state transitions.
3. Add evidence snapshot creation and freezing.
4. Implement source and claim query endpoints.
5. Add audit and review history.
6. Add test data and integration tests.

### Gate

A reviewer can create, contest, supersede, freeze, and export evidence without mutating prior history.

## Phase 7: Source ingestion and provenance

### Goal

Acquire and anchor public source materials safely and reproducibly.

### Deliverables

- source registry service;
- generic HTML, RSS, sitemap, PDF, and JSON connectors;
- G7 corpus connector;
- WARC and object-storage capture;
- HTML and PDF extraction;
- passage anchors;
- connector health metrics;
- candidate extraction interface.

### Tasks

1. Implement safe fetch sandbox.
2. Implement raw capture and hashes.
3. Implement format router.
4. Implement PyMuPDF and Trafilatura baselines.
5. Add Playwright and Docling fallbacks.
6. Implement passage anchors and visual validation.
7. Add source registry validation.
8. Add model gateway only after deterministic extraction paths are stable.

### Gate

A decisive claim can be traced from action to passage to immutable source object, and the same source can be reprocessed without invalidating the old evaluation.

## Phase 8: Analyst Studio

### Goal

Make methodology and evidence review efficient enough for real use.

### Deliverables

- workspace navigation;
- DSL editor and diagnostics;
- source viewer;
- evidence inbox;
- action workbench;
- score workbench;
- proof tree;
- review and dispute controls;
- profile and release comparison.

### Gate

A research team can complete an end-to-end assessment without direct database access or hand-editing JSON.

## Phase 9: 2025 score reproduction

### Goal

Run the complete benchmark from frozen evidence.

### Deliverables

- 160 receipts;
- comparison matrix;
- reviewed discrepancies;
- evidence coverage report;
- methodology assumption report;
- generated final report.

### Tasks

1. Import or reconstruct chapter evidence.
2. Review action identity and attribution.
3. Run all profiles.
4. Compare to published scores.
5. Resolve software and extraction defects.
6. Preserve genuine methodology or publication differences.

### Gate

Every published cell either matches or has a transparent reviewed explanation. No silent exceptions are present.

## Phase 10: Publication and verification

### Goal

Publish a durable, independently verifiable release.

### Deliverables

- release builder;
- signed manifest;
- public explorer;
- downloadable receipts and matrices;
- report generator;
- verification CLI;
- correction workflow.

### Gate

A third party can download a release, verify hashes and signatures, inspect evidence links, and replay the evaluator with the pinned bundle.

## Phase 11: Continuous monitoring

### Goal

Move from static annual reports to reviewed evidence updates.

### Deliverables

- connector schedules and cursors;
- change detection;
- candidate-action queue;
- source freshness and coverage dashboards;
- incremental evidence snapshots;
- release-diff workflow.

### Gate

New evidence produces a reviewable candidate and a prospective score diff without changing a published release.

## Phase 12: Historical and institutional expansion

### Goal

Generalize after the benchmark proves the semantics.

### Deliverables

- historical G7 data import;
- methodology migration tools;
- G20, BRICS, treaty, or voluntary-standard adapters;
- LegalRuleML, JSON-LD, and PROV exports;
- optional formal core in Lean or Alloy;
- public package registry.

### Gate

New institutions can be modeled through packages and source adapters rather than forks of the evaluator.

## Workstreams that remain human-led

Codex can implement infrastructure and assist with encoding. It should not independently decide:

- whether a source clause is a politically binding commitment;
- what an ambiguous report author intended;
- whether two government actions are materially distinct;
- whether a contested source should be accepted;
- what interpretation profile is normatively appropriate;
- whether a final score should be published.

These decisions require named reviewers and rationales.

## Parallelization guidance

Safe parallel work after schemas stabilize:

- evaluator conformance tests;
- static analyzer fixtures;
- source connector prototypes;
- Studio visual components;
- corpus indexing;
- methodology inventory.

Do not parallelize independent implementations of the canonical schema or truth semantics without an explicit reconciliation owner.

## Exit criteria for a useful product

The system becomes genuinely useful when it can:

1. encode the full 2025 methodology corpus;
2. produce reproducible receipts;
3. expose hidden assumptions and rule defects;
4. support governed evidence review;
5. publish verifiable releases;
6. update evidence without rewriting history.

A polished editor without these properties is not the product.
