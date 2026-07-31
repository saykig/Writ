# Research Sources

Access date for this build pack: 2026-07-22.

## G7 compliance methodology and corpus

### G7 Compliance Coding Manual 2020

`https://www.g7.utoronto.ca/compliance/Compliance_Coding_Manual_2020.pdf`

Relevant concepts used in this plan:

- definition and identification criteria for commitments;
- politically binding verb levels;
- future orientation and collective intent;
- issue areas, catalysts, and priority commitments;
- first-order through fourth-order compliance;
- three-point scoring and summit-to-summit evaluation;
- commitment-specific background, definitions, guidelines, and scoring metric;
- multi-year commitments, pre-compliance, reversibility, and budget announcements;
- source priorities, neutral writing, citation practice, and report templates.

### Compliance index

`https://www.g7.utoronto.ca/compliance/index.html`

Used to understand report organization across years.

### Historical dataset index

`https://www.g7.utoronto.ca/compliance/dataset/index.html`

The page describes public country-specific compliance data for 425 commitments from 1985 to 2013 across 25 issue areas.

### 2025 final compliance report index

`https://www.g7.utoronto.ca/evaluations/2025compliance-final/index.html`

Used for the 20 selected commitments, eight-member score matrix, evaluation period, report links, and living-document publication model.

### 2025 AI for SMEs chapter

`https://www.g7.utoronto.ca/evaluations/2025compliance-final/04-2025-G7-final-compliance-ai.pdf`

Used as the initial action-count example and static-analysis fixture.

### Other 2025 methodology examples

The 2025 final report chapters on Middle East peace, biodiversity, debt, transnational crime, critical minerals markets, and infrastructure partnership demonstrate multi-dimensional rules, goal and partner-class coverage, artifact completeness, direct-beneficiary requirements, exclusions, and prose-to-metric consistency issues.

## Language and policy-engine prior art

### Langium

`https://langium.org/`

TypeScript framework for textual DSLs, typed AST generation, validation, linking, and Language Server Protocol integration.

### Open Policy Agent and Rego

`https://www.openpolicyagent.org/docs/policy-language`

Declarative policy evaluation over structured data. Useful as prior art and an optional export or differential backend.

### Common Expression Language

`https://cel.dev/`

Portable, safe, non-Turing-complete expression language. Useful prior art for restricted expressions.

### Soufflé Datalog

`https://souffle-lang.github.io/`

High-performance Datalog with relations, rules, aggregates, and provenance features. Useful for relational reasoning experiments.

### Cedar

`https://www.cedarpolicy.com/`

Authorization-focused policy language with typed schemas and analyzability. Useful prior art for validation and formal modeling, but not a direct fit for compliance evaluation.

### Catala

`https://catala-lang.org/`

Literate programming language for translating law into executable specifications. Strong conceptual precedent for keeping authoritative text and executable meaning aligned.

### LegalRuleML

`https://www.oasis-open.org/committees/legalruleml/`

Interchange standard for legal rules, sources, temporal information, and reasoning metadata.

### Akoma Ntoso

`https://www.oasis-open.org/standard/akn-v1-0/`

Standard vocabulary and XML model for legislative and parliamentary documents.

## Formal analysis

### Z3

`https://github.com/Z3Prover/z3`

SMT theorem prover used for bounded overlap, exhaustiveness, reachability, and counterexample analysis.

### Alloy

`https://alloytools.org/`

Lightweight bounded model finder, useful for validating domain and relationship constraints.

### Lean

`https://lean-lang.org/`

Proof assistant suitable for later formalization of the small truth and score-selection kernel.

## Provenance, identity, and archives

### W3C PROV-O

`https://www.w3.org/TR/prov-o/`

Ontology for entities, activities, agents, and provenance relationships.

### JSON-LD 1.1

`https://www.w3.org/TR/json-ld11/`

Linked-data serialization for interoperable exports.

### OWL-Time

`https://www.w3.org/TR/owl-time/`

Ontology for instants, intervals, and temporal relationships.

### SHACL

`https://www.w3.org/TR/shacl/`

Graph validation language useful for exported linked-data conformance.

### RFC 8785 JSON Canonicalization Scheme

`https://www.rfc-editor.org/rfc/rfc8785`

Canonical JSON representation for stable hashes and signatures.

### RFC 3161 Time-Stamp Protocol

`https://www.rfc-editor.org/rfc/rfc3161`

Optional trusted timestamping for release artifacts.

### WARC

`https://www.iso.org/standard/68004.html`

Standard format for preserving web resources and crawl metadata.

### Internet Archive APIs

`https://archive.org/developers/`

Potential archive availability and capture integration, subject to service policy.

## Data standards

### Open Contracting Data Standard

`https://standard.open-contracting.org/latest/en/`

Common model for contracting data and documents across planning, tender, award, contract, and implementation.

### International Aid Transparency Initiative Standard

`https://iatistandard.org/en/iati-standard/`

Rules and schemas for development and humanitarian activities, organizations, transactions, budgets, sectors, locations, and results.

### DCAT

`https://www.w3.org/TR/vocab-dcat-3/`

Dataset catalog vocabulary.

### SDMX

`https://sdmx.org/`

Standards for statistical data and metadata exchange.

### European Legislation Identifier

`https://eur-lex.europa.eu/eli-register/about.html`

Persistent identifiers and metadata for legislation.

## Crawling and extraction

### Playwright

`https://playwright.dev/`

Browser automation for JavaScript-heavy sources, rendered capture, and browser testing.

### Scrapy

`https://scrapy.org/`

Crawler framework for source discovery, scheduling, throttling, and extraction pipelines.

### Trafilatura

`https://trafilatura.readthedocs.io/`

Main-text and metadata extraction from HTML.

### PyMuPDF

`https://pymupdf.readthedocs.io/`

PDF text, geometry, image, link, and metadata extraction.

### Docling

`https://docling-project.github.io/docling/`

Document conversion and advanced PDF understanding, including layout, reading order, tables, and OCR.

### Apache Tika

`https://tika.apache.org/`

Broad text and metadata extraction across many file formats.

### Warcio

`https://warcio.readthedocs.io/`

Python library for reading and writing WARC records.

## Codex project guidance

### AGENTS.md

`https://developers.openai.com/codex/agent-configuration/agents-md`

Used to structure durable repository instructions.

### Codex best practices

`https://developers.openai.com/codex/learn/best-practices`

Used to make tasks explicit, scoped, testable, and rich in repository context.

### Codex skills

`https://developers.openai.com/codex/build-skills`

Used for the checked-in domain skill in `.agents/skills/writ-domain/`.
