# Ingestion, Extraction, and Provenance

## 1. Pipeline overview

```text
Source registry
  -> discovery
  -> safe fetch
  -> immutable raw capture
  -> format detection
  -> structured extraction
  -> passage anchoring
  -> candidate claim extraction
  -> entity and action resolution
  -> analyst review
  -> accepted evidence snapshot
```

Every stage emits versioned artifacts and logs. A later stage never overwrites an earlier artifact.

## 2. Discovery

Inputs:

```text
member
commitment
issue areas
evaluation window
as-of cutoff
source packs
keywords and controlled vocabulary
known programs and entities
connector cursor
```

Outputs:

```text
candidate URI or API record
publisher
published or updated time
source registry entry
query or feed position
discovery score
discovery rationale
```

Discovery scores prioritize review. They have no role in compliance scoring.

## 3. Safe fetching

Controls:

- egress allowlist by connector;
- DNS and IP validation to prevent SSRF;
- redirect limits;
- decompressed size limits;
- content-type validation;
- archive-bomb protection;
- malware scanning where appropriate;
- request identification and contact information;
- per-source rate limits;
- robots and terms enforcement;
- no browser credential reuse across sources;
- sandboxed JavaScript rendering.

Fetch metadata:

```text
requested URI
resolved URI
redirect chain
request headers
response headers
status
TLS information where available
retrieved time
content length
content hash
connector version
```

## 4. Raw capture

Store:

- original response bytes;
- WARC record for web resources;
- rendered DOM for JavaScript pages;
- screenshot where layout matters;
- API response body and request parameters;
- attachment bytes;
- fetch metadata;
- content hash.

Use object-lock or equivalent immutability for released evidence objects.

## 5. Format routing

### HTML

Preferred tools:

- Trafilatura for main text and metadata.
- lxml or selectolax for structural extraction.
- Playwright for JavaScript rendering and screenshots.
- Readability-style fallback only when the primary extractor fails.

Retain:

```text
raw HTML
rendered HTML
main text
headings
links
metadata
DOM paths
language
```

### PDF

Preferred tools:

- PyMuPDF for text spans, pages, images, links, and geometry.
- Docling for complex layout, tables, reading order, and OCR fallback.
- Tika as a general fallback.

Retain:

```text
raw PDF
page images for validation where required
text spans with coordinates
reading order
tables and cells
embedded metadata
attachments
parser confidence
```

OCR is a last resort. OCR output must be labelled and anchored to page images.

### Office and miscellaneous documents

- Apache Tika for broad text and metadata extraction.
- Native parsers where fidelity matters.
- Preserve embedded files and original package structure when practical.

### Structured APIs

Retain the full response and schema version. Passage anchors use JSON Pointer plus a canonicalized value hash.

## 6. Document normalization

Normalize without destroying original distinctions:

- Unicode normalization;
- language detection;
- paragraph and heading segmentation;
- table structure;
- page and DOM geometry;
- date candidates;
- monetary and quantity candidates;
- institution and jurisdiction candidates;
- official identifiers;
- duplicated boilerplate markers.

The normalized text is derived data. Original bytes remain authoritative.

## 7. Passage anchoring

### PDF anchor

```text
document_version_id
page number
bounding boxes
text span indices
normalized quote
context before and after
anchor hash
```

### HTML anchor

```text
document_version_id
DOM path
text node offsets
normalized quote
context
rendered DOM hash
```

### API anchor

```text
document_version_id
JSON Pointer
canonical value hash
request parameters
```

### Table anchor

```text
document_version_id
table identifier
row and column keys
cell coordinates
header path
```

Anchors should support visual highlighting in the review interface.

## 8. Candidate extraction

Model-assisted extraction may propose:

```text
action label
actor
jurisdiction
action kind
instrument type
beneficiary
targeting
implementation stage
announcement and valid times
amount and unit
program or instrument name
partner classes
dimensions or goals
relationships to known actions
supporting passage ids
```

Required model behavior:

- structured output validated by schema;
- every field linked to one or more passages or marked inferred;
- no unsupported completion of missing values;
- original-language values retained;
- translation separated from extraction;
- model and prompt version logged;
- source text treated as untrusted data, not instruction.

## 9. Entity resolution

Resolution pipeline:

1. exact official identifier match;
2. canonical URL or legal identifier match;
3. normalized name and alias match;
4. jurisdiction and organization-context match;
5. fuzzy candidate generation;
6. analyst decision for score-relevant ambiguity.

Never merge two programs solely because their names are similar.

## 10. Action resolution and deduplication

Candidate relationships are generated using:

- shared official program identifier;
- shared budget line or legal instrument;
- explicit announcement links;
- same amount, beneficiary, and implementing department;
- program naming and timeline;
- source statements such as launch, continuation, amendment, or expansion.

The system proposes clusters. A reviewer accepts the methodology count identity.

Use RapidFuzz or equivalent only for candidate generation. A vector model can help retrieve possible matches, but it does not decide identity.

## 11. Negative evidence protocol

A claim such as "no qualifying action was found" requires a record with:

```text
commitment and member
search window
sources and source packs queried
queries and controlled terms
languages
connector cursors
last successful fetch times
known inaccessible sources
analyst identity
reviewer identity
completeness standard
conclusion truth value
```

A source outage or inaccessible archive generally yields `unknown`, not `false`.

## 12. Provenance model

Use W3C PROV concepts for export:

- `prov:Entity`: document versions, passages, claims, actions, bundles, receipts.
- `prov:Activity`: fetch, extraction, translation, review, compilation, evaluation, publication.
- `prov:Agent`: institution, analyst, reviewer, software build, model.

Internal storage can remain relational. Export selected records as JSON-LD using PROV-O mappings.

## 13. Chain of custody

For every published receipt:

```text
receipt
 -> evaluation run
 -> methodology bundle
 -> interpretation profile
 -> evidence snapshot
 -> accepted classifications
 -> accepted claims
 -> passages
 -> immutable document versions
 -> source fetches
```

Every arrow has an identifier and recorded time.

## 14. Content hashing and signing

- SHA-256 for content addresses.
- RFC 8785-compatible JSON canonicalization.
- Signed release manifests using an organizational signing key or Sigstore-compatible workflow.
- Optional RFC 3161 timestamping for formal publication evidence.

Do not sign individual model suggestions. Sign approved methodology and release boundaries.

## 15. Translation

Translation records contain:

```text
source passage
source language
target language
translation text
translator type: human or model
translator identity or model version
review status
notes
```

Rules should cite the original passage and may display an approved translation. A translation is never treated as the original source.

## 16. Extraction quality checks

### Automated

- text length and empty-page checks;
- repeated-header and footer detection;
- reading-order anomaly detection;
- table consistency checks;
- page-count comparison;
- OCR confidence thresholds;
- anchor round-trip tests;
- source and extracted-date consistency.

### Human

- visual inspection of score tables and complex layouts;
- confirmation of decisive passages;
- review of OCR-derived decisive claims;
- comparison of official-language and translated text.

## 17. Reprocessing

A new parser version creates a new extraction artifact. It does not change the source object.

The system should support:

- re-extracting all documents affected by a parser defect;
- comparing old and new extracted text;
- identifying claims whose anchors no longer resolve in the new extraction;
- retaining prior evaluation reproducibility.

## 18. Workflow state machines

### Document

```text
discovered -> fetched -> extracted -> quality_checked -> available
                                  -> failed -> retryable or quarantined
```

### Claim

```text
candidate -> in_review -> accepted
                       -> rejected
                       -> contested
accepted -> superseded
```

### Methodology

```text
draft -> compiling -> review -> approved -> published -> superseded
```

### Evaluation

```text
queued -> running -> completed -> review -> approved -> published
                   -> unresolved
                   -> failed
```

## 19. Observability

Track:

```text
fetch success and latency
HTTP error distribution
source freshness
extraction success by format
OCR usage
anchor failure rate
candidate extraction volume and precision
review queue age
connector cursor lag
score-decisive source gaps
reprocessing impact
```

Logs must not contain secrets or full restricted-source content.
