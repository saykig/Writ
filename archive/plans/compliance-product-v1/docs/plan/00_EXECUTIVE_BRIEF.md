# Executive Brief

## The highest-level answer

A useful DSL for G7 compliance should encode the governed path from an international commitment to an accepted compliance judgment. It should not pretend that political interpretation is purely mechanical, and it should not hide analyst judgment inside prose or model prompts.

The product should therefore be built as an **auditable policy evaluation compiler** with three separately governed layers:

1. **Normative specification**: what was promised, by whom, under which definitions, during what evaluation window, and under which scoring methodology.
2. **Evidence ledger**: what public actions occurred, what sources support them, how they were attributed, and what reviewers accepted or disputed.
3. **Evaluation receipt**: the deterministic derivation from accepted evidence and a versioned interpretation profile to a score or unresolved result.

A generated report is a view over those layers. It is not the source of truth.

## Why a DSL is justified

The G7 Research Group methodology already behaves like a family of programs. It identifies commitments using criteria such as specificity, collective intent, political binding language, and future orientation. It then defines commitment-specific guidance, reviews national actions in a summit-to-summit window, classifies evidence, and produces a three-point result.

The individual reports are not governed by one universal formula. Across the 2025 chapters, score rules include:

- simple action-count thresholds;
- strong, weak, and countervailing classifications;
- multiple required dimensions;
- coverage across goals or partner classes;
- artifact completeness tests;
- direct-beneficiary and jurisdiction exclusions;
- temporal maturity tests;
- multi-year and reversibility rules;
- mixed strong and weak combinations;
- explicit and implicit precedence rules.

This variety makes a typed rule algebra useful. A spreadsheet or generic rules engine can store thresholds, but it will not adequately represent source alignment, unknown evidence, contested classifications, action identity, policy versioning, and proof receipts.

## Product thesis

**Writ should make compliance judgments reproducible, inspectable, challengeable, and continuously updateable without claiming to remove human judgment.**

The strongest use cases are:

- reproducing a published evaluation from frozen evidence;
- showing exactly why a member received a score;
- identifying which actions counted and which were excluded;
- comparing strict and inclusive interpretations;
- detecting rule gaps before publication;
- updating an evaluation when new evidence appears;
- generating country, commitment, and summit reports from the same governed state;
- extending the architecture to G20, BRICS, treaty implementation, voluntary standards, and corporate commitments.

## Critical design choices

### 1. Canonical IR before custom syntax

Build the domain model, schemas, evaluator, and proof format first. Hand-author JSON fixtures and reproduce published results. Only then stabilize the textual syntax.

### 2. Deterministic evaluator as the scoring authority

Language models can extract candidates and help analysts search. They must not directly assign or publish scores. The source-of-truth evaluator operates on reviewed, structured records.

### 3. Four-valued evidence logic

Use `true`, `false`, `unknown`, and `contested`. Public-source research is open-world. A missing record is not proof that an action did not happen.

### 4. Explicit interpretation profiles

An interpretation profile controls questions such as whether announcements count, how collective actions are attributed, how counteractions take precedence, and whether one program can produce multiple countable actions. Different profiles can be compared without rewriting evidence.

### 5. Immutable source and release history

Store original bytes or compliant snapshots, HTTP metadata, extraction output, anchors, and hashes. Corrections create new records. Published releases are signed and replayable.

### 6. Human adjudication is a first-class workflow

Evidence candidates become accepted facts only through review. Conflicts and dissent are preserved, not erased.

## Recommended stack

### Language and core services

- TypeScript monorepo.
- Langium for parser, typed AST generation, linking, validation, and Language Server Protocol support.
- Monaco for the browser editor.
- JSON Schema 2020-12 and AJV for canonical IR validation.
- A custom deterministic evaluator in TypeScript.
- Z3 for bounded overlap, exhaustiveness, reachability, and contradiction analysis.
- Exact decimal arithmetic and explicit units for money and quantities.

### Evidence ingestion

- Python workers.
- Scrapy for structured crawling and source discovery.
- Playwright for JavaScript-heavy pages and rendered capture.
- Trafilatura for main-text extraction from HTML.
- PyMuPDF for fast PDF extraction and geometry.
- Docling for complex PDF layout, tables, and OCR fallback.
- Apache Tika as a broad file-format fallback.
- Warcio for WARC storage.

### Data and infrastructure

- PostgreSQL with JSONB and bitemporal records.
- S3-compatible object storage for immutable source objects and WARC files.
- PostgreSQL full-text search first; vector retrieval only for candidate discovery.
- Fastify and OpenAPI 3.1 for the API.
- OIDC, role-based access, append-only audit events, and signed releases.
- Docker Compose for local development; production deployment can remain platform-neutral.

## First benchmark

Use the 2025 final report as the primary benchmark corpus:

- encode all 20 selected commitments;
- evaluate all eight members;
- compare 160 published score cells;
- record every discrepancy as one of:
  - evidence missing from the public chapter;
  - implicit analyst interpretation;
  - rule gap;
  - rule overlap;
  - prose and score-table inconsistency;
  - action identity or attribution ambiguity;
  - data extraction error.

Success is not merely matching 160 cells. Success is producing a **discrepancy ledger that explains what had to be assumed to match them**.

## The first release should include

- a compiler and static analyzer;
- a deterministic evaluator and proof receipt;
- an evidence ledger API;
- source snapshot and passage anchoring;
- analyst review and adjudication;
- three representative commitment types;
- the full 2025 methodology corpus as the first production target;
- a report generator and public receipt viewer.

Continuous automated monitoring, historical backfill, formal proof in Lean, and cross-institution generalization belong after the 2025 benchmark is stable.

## Non-negotiable acceptance conditions

- Same bundle, evidence snapshot, and evaluator build produce byte-identical canonical receipts.
- No score silently treats unknown evidence as false.
- Every published score traces to accepted claims and immutable source snapshots.
- The analyzer exposes the ambiguity in operationalizing “up to four strong actions,” including the gap produced by a one-to-four normalization and the overlap produced by a zero-to-four normalization.
- The analyzer detects unprioritized overlap between strong action thresholds and counteraction rules.
- The system can represent the multi-dimensional and partner-coverage requirements in the critical-minerals chapter without a custom code plug-in.
- A reviewer can challenge one action classification without invalidating unrelated evidence.
- A new release never mutates the audit history of a prior release.
