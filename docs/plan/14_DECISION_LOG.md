# Decision Log

These are the default decisions Codex should implement unless a new ADR changes them.

## D-001 The product is an evaluation compiler, not merely a syntax

Decision: Build methodology authoring, evidence governance, deterministic evaluation, receipts, and publication as one architecture.

Reason: A syntax without governed evidence and reproducible derivation does not solve the compliance-research problem.

## D-002 Canonical IR precedes parser completion

Decision: JSON Schema and the evaluator are authoritative before the Langium grammar is finalized.

Reason: Real report semantics should shape the language, and parser syntax should not hard-code an immature model.

## D-003 TypeScript is the core implementation language

Decision: Use TypeScript for schemas, compiler, evaluator, analyzer, API, CLI, and browser integration.

Reason: Shared types and first-class Langium and Monaco integration outweigh the benefits of a lower-level language at this scale.

## D-004 Python owns crawling and document extraction

Decision: Use isolated Python workers for source acquisition and parsing.

Reason: Scrapy, Trafilatura, PyMuPDF, Docling, and the broader extraction ecosystem are strongest in Python.

## D-005 Custom evaluator is canonical

Decision: Implement the source-of-truth evaluator directly rather than using Rego, CEL, Soufflé, SQL, or a language model.

Reason: Four-valued evidence logic, uncertain count intervals, proof receipts, contested identity, and source dependencies are first-class semantics.

## D-006 Rego, CEL, Datalog, and LegalRuleML are optional exports

Decision: Support them only as interoperability or differential-testing targets.

Reason: They are useful prior art and integration formats, but none should control canonical scoring behavior.

## D-007 Four-valued truth is mandatory

Decision: Use true, false, unknown, and contested.

Reason: Open-source policy research routinely faces missing and conflicting evidence. Nullable Boolean or three-valued SQL semantics are insufficient.

## D-008 Human review gates evidence

Decision: Models and extractors create candidates only.

Reason: The politically consequential step is accepting a fact or classification, not extracting a phrase.

## D-009 PostgreSQL and object storage are the primary data stores

Decision: Use PostgreSQL for relational state and JSONB, plus S3-compatible storage for immutable source objects.

Reason: This minimizes operational complexity while preserving integrity and query flexibility.

## D-010 No graph database in the MVP

Decision: Represent relationships relationally and export JSON-LD or PROV-O.

Reason: The data is graph-shaped, but a graph database is not yet a demonstrated control point.

## D-011 Z3 is used for bounded methodology analysis, not runtime scoring

Decision: Lower finite score conditions to SMT for overlap, exhaustiveness, reachability, and monotonicity checks.

Reason: Formal counterexamples are valuable during authoring, while runtime scoring should remain simple and transparent.

## D-012 Count identity is explicit

Decision: Every methodology that counts actions declares or imports an identity policy.

Reason: Announcement splitting and program duplication can otherwise alter scores without substantive policy change.

## D-013 Interpretation profiles are separate from evidence

Decision: Strict and inclusive interpretations reuse the same accepted evidence.

Reason: Evidence disputes and normative interpretation disputes are different problems.

## D-014 Release history is immutable

Decision: Corrections produce new methodology versions, evidence snapshots, receipts, and releases.

Reason: Public audit requires replay of what was known and decided at each publication point.

## D-015 WARC and content hashes preserve web evidence

Decision: Capture web resources in WARC where permitted and store immutable hashes and metadata.

Reason: Government pages change and disappear. URLs alone are inadequate provenance.

## D-016 Source hierarchy is configurable but explicit

Decision: Start with government, oversight, international organization, major media, research, and lead tiers.

Reason: The coding manual has a source-priority logic, but issue-specific evidence quality requires more than a single rank.

## D-017 Exact decimals and explicit units

Decision: Do not use floating point for money, thresholds, ratios, or quantities.

Reason: Auditability and threshold correctness require exact representation.

## D-018 The first benchmark is the full 2025 selected set

Decision: Encode 20 methodologies and compare 160 member-commitment cells.

Reason: The corpus is large enough to challenge the design and recent enough to expose modern policy evidence patterns.

## D-019 A mismatch is data, not a failure to hide

Decision: Preserve benchmark discrepancies with categories and rationale.

Reason: A system that merely forces agreement cannot expose implicit methodology or published inconsistency.

## D-020 Codex work is task-gated

Decision: Use small, dependency-aware tasks with tests and stop conditions.

Reason: Complex agentic builds improve when repository instructions, acceptance criteria, and context are explicit. Large one-shot implementation encourages semantic drift.
