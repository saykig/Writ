# Library and Standards Matrix

This matrix separates the canonical choice from useful alternatives. Resolve current stable versions during repository bootstrap and commit lockfiles.

## Language workbench

| Need | Canonical choice | Supporting or alternate tools | Decision rule |
|---|---|---|---|
| Grammar, typed AST, linking, validation, LSP | Langium | ANTLR4, Xtext | Use Langium because the primary stack is TypeScript and editor tooling is a first-class deliverable. |
| Incremental syntax highlighting | Langium LSP plus Monaco | Tree-sitter | Add Tree-sitter only if very large files expose measurable editor latency. |
| Browser editor | Monaco Editor | CodeMirror | Monaco aligns with LSP, diagnostics, code actions, and diff views. |
| Literate files | Unified/remark or a small fenced-block extractor | Pandoc AST | Preserve Markdown positions and compile only `writ` fences. |

## Canonical data and types

| Need | Choice | Notes |
|---|---|---|
| Interchange validation | JSON Schema draft 2020-12 plus AJV | Schemas are authoritative. Generated TypeScript types must be checked for drift. |
| Type generation | `json-schema-to-typescript` or a controlled generator | Review unions and exact optionality in generated output. |
| Canonical JSON | RFC 8785-compatible serializer | Add golden vectors and cross-language tests. |
| Exact decimal values | `decimal.js` | Never use binary floating point for money or threshold-sensitive decimals. |
| Date and time | Temporal API or `@js-temporal/polyfill` | Keep evaluation time, valid time, recorded time, and retrieval time distinct. |
| Units | UCUM identifiers plus a small governed conversion registry | Avoid silent unit conversion and ambiguous currency basis. |

## Semantics and analysis

| Need | Canonical choice | Role of alternatives |
|---|---|---|
| Score authority | Custom pure TypeScript evaluator | OPA/Rego, CEL, Cedar, and Soufflé may be export targets or comparison engines, not the authority. |
| Four-valued truth | Small reviewed algebra in the evaluator | Use Belnap-style independent support for truth and falsity. |
| Bounded static analysis | Z3 | Alloy is useful for model exploration; Lean is useful later for a small formally verified kernel. |
| Property tests | fast-check | Hypothesis covers the Python side. |
| Mutation tests | StrykerJS | Apply to truth tables, score selection, and canonicalization. |

## API and persistence

| Need | Choice | Notes |
|---|---|---|
| HTTP API | Fastify plus OpenAPI 3.1 | Generate contract tests and clients from the published specification. |
| PostgreSQL access | Kysely or direct `pg` | Preserve visibility into range, JSONB, locking, and append-only queries. |
| Migrations | SQL migration files with checksums | Do not rely on automatic ORM schema synchronization. |
| Background jobs | PostgreSQL-backed worker such as Graphile Worker or pg-boss | Select after a failure and concurrency spike. Avoid a second queue system in the MVP. |
| Object storage | S3 API through AWS SDK; MinIO locally | Store immutable bytes, WARC records, renderings, and release artifacts. |
| Search | PostgreSQL full-text search | Add pgvector only for candidate discovery; add OpenSearch only after measured need. |
| Authentication | OIDC | Use a managed provider or Keycloak; keep authorization policy in the application and audit log. |

## Studio

| Need | Choice | Notes |
|---|---|---|
| Application | React plus Vite | Keep semantic code in packages, not UI components. |
| Server state | TanStack Query | Use stable query keys that include workspace and snapshot identity. |
| Large tables | TanStack Table plus virtualization | Required for evidence queues and the 160-cell benchmark. |
| Rule editor | Monaco plus Langium LSP | Surface diagnostics, source anchors, inferred types, and scenario results. |
| Proof visualization | React Flow or Cytoscape.js | The primary view is a collapsible proof tree; a graph is secondary. |
| Accessibility | axe-core and Playwright | Include keyboard-only review workflows. |

## Acquisition and extraction

| Need | Primary library | Fallback or companion |
|---|---|---|
| HTTP client | `httpx` | Tenacity for policy-aware retries. |
| Crawling and feeds | Scrapy | Feedparser for simple RSS/Atom adapters. |
| Rendered pages | Playwright | Use only when deterministic HTTP retrieval is insufficient. |
| HTML main text | Trafilatura | Selectolax or lxml for structured extraction and DOM paths. |
| PDF text and geometry | PyMuPDF | Docling for complex layout and tables; Tika for broad format fallback. |
| WARC | warcio | Preserve request and response metadata. |
| Office and mixed formats | Apache Tika | Route structured native formats before generic extraction. |
| Entity and duplicate candidates | RapidFuzz | Splink for large probabilistic linkage after the benchmark. |
| Dataframe analysis | Polars and DuckDB | Useful for benchmark QA and source exports, not transactional state. |
| Structured Python contracts | Pydantic | Mirror JSON Schema contracts and test round trips. |

## Provenance, identity, and publication standards

- W3C PROV-O for provenance export.
- JSON-LD for linked-data representation.
- OWL-Time for temporal export.
- SHACL for optional graph validation.
- WARC for captured web resources.
- RFC 8785 for canonical JSON.
- RFC 3161 or a transparency service for optional trusted timestamps.
- JOSE with Ed25519 for release signatures.
- Sigstore and Cosign for container and build artifact signing.

## Public-data interoperability

- Open Contracting Data Standard for procurement lifecycle records.
- International Aid Transparency Initiative for development activities and transactions.
- OECD DAC/CRS for development finance.
- SDMX for official statistics.
- XBRL for budgets and financial reports where available.
- DCAT and DCAT-AP for catalog metadata.
- European Legislation Identifier for legislation identity.
- Akoma Ntoso for legislative and parliamentary structure.
- LegalRuleML as an optional legal-rule export, not the authoring language.

## Report generation

Use accessible HTML as the primary report representation. Generate archival PDF through a controlled browser print pipeline or Typst after the HTML and receipt outputs are stable. Pandoc is useful for interchange, but generated prose must come from deterministic templates and proof data.

## Deliberate exclusions from the MVP

- No LLM-as-judge score path.
- No graph database in the critical path.
- No standalone vector database.
- No OCR-first extraction.
- No generic policy engine as canonical semantics.
- No automatic ORM migrations.
- No custom cryptographic primitives.
