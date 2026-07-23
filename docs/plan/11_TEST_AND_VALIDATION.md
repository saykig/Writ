# Test and Validation Strategy

## 1. Testing objective

The system must demonstrate both software correctness and methodological fidelity. Passing unit tests is insufficient if the encoded methodology cannot reproduce or explain the published corpus.

## 2. Test layers

### 2.1 Schema tests

- Every example validates against the declared schema version.
- Invalid fixtures fail with expected paths and diagnostic codes.
- Schema migrations preserve declared compatibility.
- Canonicalization is stable across property order and whitespace.

### 2.2 Truth-logic tests

Exhaustively test all combinations of:

```text
not
and
or
forall
exists
```

across `true`, `false`, `unknown`, and `contested`.

### 2.3 Expression tests

- equality and comparison;
- exact decimal behavior;
- unknown operands;
- contested operands;
- date and interval boundaries;
- set operations;
- count intervals;
- coverage intervals;
- artifact completeness;
- identity uncertainty.

### 2.4 Evaluator unit tests

- unique score selection;
- same-result overlap;
- different-result overlap;
- priority;
- explicit otherwise;
- decisive unknown;
- contested branch;
- exclusion and qualification lists;
- proof-tree completeness.

### 2.5 Property-based tests

Use fast-check or equivalent.

Properties:

- evaluation is deterministic;
- canonical hash is invariant to object key order;
- adding definitely irrelevant evidence does not change a result;
- increasing a declared monotonic count cannot reduce score unless a declared exception becomes true;
- deduplicating duplicate evidence passages does not change action counts;
- superseded claims are absent from new snapshots but remain replayable in old snapshots;
- no receipt references an object outside its frozen inputs.

### 2.6 Static analyzer tests

Each diagnostic has:

- a minimal positive fixture;
- a nearby negative fixture;
- expected witness;
- stable diagnostic code;
- severity expectation.

### 2.7 Parser and compiler tests

- grammar snapshots;
- formatter idempotence;
- source-map round trips;
- imported symbol resolution;
- version-lock behavior;
- AST to IR golden files;
- meaningful recovery from syntax errors;
- literate Markdown extraction.

### 2.8 Ingestion tests

Use frozen source fixtures rather than live sites in CI.

- HTML extraction;
- JavaScript-rendered page;
- PDF text and geometry;
- complex table;
- scanned PDF OCR fallback;
- API JSON and JSON Pointer anchoring;
- WARC read and write;
- redirect and content-type handling;
- rate-limit retry;
- malformed file quarantine.

### 2.9 Anchor tests

A passage anchor must resolve to the same normalized quote in the same immutable document version.

Visual tests verify decisive PDF and HTML highlights.

### 2.10 Security tests

- SSRF targets;
- DNS rebinding defenses;
- archive bombs;
- oversized PDFs;
- malicious HTML and XSS;
- prompt-injection documents;
- unauthorized status transitions;
- stale optimistic-lock writes;
- signature tampering;
- restricted-source leakage.

## 3. Conformance corpus

Create a language-implementation-independent conformance suite.

Folders:

```text
conformance/truth
conformance/types
conformance/time
conformance/quantities
conformance/classification
conformance/scoring
conformance/proofs
conformance/canonicalization
conformance/errors
```

Each case contains:

```text
input bundle
input evidence
profile
expected receipt or diagnostic
human explanation
```

## 4. 2025 benchmark corpus

### 4.1 Scope

- 20 selected commitments.
- 8 evaluated members.
- 160 score cells.
- 20 chapter methodologies.
- overall score matrix.

### 4.2 Methodology diversity set

At minimum, encode these first:

1. AI for SMEs: action-count thresholds and known gap.
2. Middle East peace: two dimensions and combination rules.
3. Biodiversity: multiple dimensions and goal coverage.
4. Debt: criteria counts across two categories.
5. Transnational crime: prose and threshold consistency fixture.
6. Critical minerals market: dimensions, partner classes, and artifact completeness.
7. Infrastructure partnership: direct-beneficiary requirement and unilateral-action exclusion.

This set tests the rule algebra before all 20 chapters are encoded.

### 4.3 Benchmark comparison

For every cell:

```text
published result
computed result
match status
methodology version
evidence snapshot
interpretation profile
discrepancy id if not exact
```

Do not force a match by silently adding exceptions. A mismatch is useful evidence about methodology or source completeness.

## 5. Discrepancy validation

A benchmark discrepancy is resolved only when one of these is documented:

- missing public evidence was added;
- an extraction defect was fixed;
- an explicit interpretation was encoded;
- the formal rule was corrected;
- the published result appears inconsistent and is preserved as a benchmark difference;
- the result remains unresolved.

## 6. Human calibration

Run double review on a representative sample across members and issue areas.

Measure:

- claim acceptance agreement;
- implementation-stage agreement;
- action identity agreement;
- classification agreement;
- score agreement;
- rationale completeness.

Disagreements should improve definitions and examples, not be averaged away.

## 7. Model validation

Use held-out documents and measure:

```text
candidate action precision
candidate action recall
actor accuracy
date accuracy
amount accuracy
implementation-stage accuracy
passage-grounding precision
unsupported-field rate
duplicate-retrieval recall
prompt-injection success rate
```

Production automation should optimize reviewer time while preserving high recall. Model candidates can be noisy without affecting scores, provided acceptance remains gated.

## 8. Mutation testing

Mutate score rules and verify that tests fail:

- change `>= 5` to `> 5`;
- delete a branch;
- swap `and` and `or`;
- change priority;
- remove identity key;
- treat unknown as false;
- widen the evaluation window;
- count announcements as implementation.

The evaluator and benchmark tests should catch semantically meaningful mutations.

## 9. Differential testing

Optional backends such as Rego or Datalog can evaluate a compatible subset. Compare their outputs with the canonical evaluator for shared fixtures. Any divergence is investigated, but the custom evaluator remains authoritative.

## 10. Performance tests

Benchmark:

- editor diagnostics on a package;
- compile time for all 20 methodologies;
- static analysis over declared bounds;
- evaluation for 160 cells;
- proof receipt size;
- full-text evidence queries;
- source extraction throughput.

Set performance budgets after the benchmark corpus is measured. Do not optimize before correctness.

## 11. Release validation gates

A software release requires:

- unit, property, integration, security, and conformance tests pass;
- schema and migration compatibility checked;
- evaluator deterministic replay passes;
- SBOM produced;
- image and artifact signatures produced;
- known limitations documented.

A methodology release additionally requires:

- no unwaived blocking diagnostics;
- source anchors resolved;
- scenarios pass;
- methodologist approval;
- semantic-version check.

A compliance report release additionally requires:

- evidence snapshot frozen;
- score-decisive claims reviewed;
- receipts verified;
- discrepancies reviewed;
- release manifest signed;
- public-source rights checked.

## 12. Definition of done for the 2025 benchmark

- All 20 methodologies compile.
- All 160 evaluations run.
- Every cell matches or has a reviewed discrepancy.
- Every receipt is reproducible.
- Known seeded methodology defects are detected.
- No result relies on an unanchored accepted claim.
- Public report output is generated from receipts.
- A third party can verify release hashes and inspect rule paths.
