# Product Requirements

## 1. Product definition

Writ is a policy-compliance authoring, evidence, evaluation, and publication system. It converts source-linked commitment methodology into executable rules and converts reviewed public evidence into deterministic compliance receipts.

### Primary output

For a given commitment, member, evidence cutoff, methodology version, and interpretation profile, the system returns one of:

- `+1` full or nearly full compliance;
- `0` partial compliance or work in progress;
- `-1` non-compliance;
- `not_applicable` where methodology explicitly permits it;
- `unresolved` where available evidence or rule semantics cannot support a unique result.

A scalar score is never returned alone. It is embedded in a receipt.

## 2. Users and responsibilities

### Methodologist

- imports or transcribes authoritative commitment text;
- defines terms and methodology;
- encodes classifications and score rules;
- resolves compiler diagnostics;
- approves interpretation profiles;
- signs a methodology release.

### Analyst

- searches approved sources;
- reviews extracted candidate actions;
- creates evidence claims;
- links claims to immutable passages;
- proposes classifications and deduplication relationships;
- records negative-search protocols where required.

### Reviewer

- accepts, rejects, or contests claims;
- resolves duplicate and attribution questions;
- records rationale;
- requests additional evidence;
- approves an evaluation run for publication.

### Auditor or public reader

- inspects sources, passages, actions, and proof paths;
- compares releases or interpretation profiles;
- downloads machine-readable receipts;
- submits a challenge without altering the published record.

### Source curator

- maintains source registry entries;
- sets trust tiers, crawl methods, schedules, and legal constraints;
- disables broken or unsafe connectors;
- monitors coverage and freshness.

### Administrator

- manages identities, roles, releases, secrets, and retention controls;
- cannot silently edit accepted evidence or published receipts.

## 3. Core workflows

### 3.1 Commitment identification

1. Ingest official summit documents.
2. Detect candidate clauses.
3. Evaluate the five commitment-identification properties from the coding manual:
   - discrete statement;
   - sufficient specificity;
   - politically binding language;
   - future orientation;
   - collective or member-directed intent.
4. Preserve both accepted and rejected candidates with rationale.
5. Assign stable commitment identifiers.

### 3.2 Priority selection

1. Attach issue-area metadata and catalyst features.
2. Apply a versioned priority-selection policy where one exists.
3. Record human selections and reasons when no deterministic policy exists.
4. Never conflate commitment existence with inclusion in the monitored subset.

### 3.3 Methodology authoring

1. Create a DSL package tied to source text.
2. Declare subjects, dates, definitions, dimensions, goals, exclusions, classifications, and score rules.
3. Compile to canonical IR.
4. Run static analysis.
5. Resolve or explicitly waive every blocking diagnostic.
6. Publish an immutable methodology bundle.

### 3.4 Evidence acquisition

1. Query the source registry based on member, issue area, date window, and source tier.
2. Capture source objects and metadata.
3. Extract text, tables, and geometry.
4. Generate candidate claims and actions.
5. Require analyst confirmation before candidate records enter the evidence ledger.

### 3.5 Evidence adjudication

1. Review source authenticity and passage relevance.
2. Determine actor, beneficiary, action type, implementation stage, amount, temporal validity, and attribution.
3. Link related announcements to an underlying instrument or program family.
4. Accept, reject, or contest each claim.
5. Preserve reviewer identity, time, rationale, and prior state.

### 3.6 Evaluation

1. Freeze a methodology bundle, evidence snapshot, subject, cutoff, and interpretation profile.
2. Derive predicates and classifications.
3. Evaluate all score branches.
4. Detect unresolved evidence and branch ambiguity.
5. Emit a canonical receipt and human-readable explanation.
6. Compare with any published benchmark result.

### 3.7 Publication and correction

1. Group approved receipts into a release.
2. Generate member, commitment, and overall summaries.
3. Sign the release manifest.
4. Publish a public explorer and downloadable artifacts.
5. On correction, create a new evidence or methodology version and a new release.

## 4. Functional requirements

### FR-001 Stable identifiers

Every summit, document, commitment, rule, source, snapshot, passage, claim, action, review, run, receipt, and release has a stable identifier. Human-readable aliases are not primary keys.

### FR-002 Literate source alignment

A methodology author can place DSL blocks beside explanatory prose and link definitions or rules to exact source passages.

### FR-003 Typed ontology

The compiler understands entities, enums, sets, dates, intervals, money, quantities, jurisdictions, actors, documents, actions, evidence claims, and truth values.

### FR-004 Reusable modules

Common concepts such as G7 members, implementation stages, source tiers, attribution modes, and quantity units are importable from versioned standard packages.

### FR-005 Rule algebra

The DSL supports:

- Boolean and four-valued operators;
- quantifiers;
- counts and distinct counts;
- set and coverage operations;
- sums and ratios;
- date and interval predicates;
- artifact completeness;
- multi-dimensional rules;
- precedence;
- explicit defaults;
- assertions and executable examples.

### FR-006 Classification

Rules may classify an action globally or by dimension. The engine records every matched rule, not only the final label.

### FR-007 Action identity and deduplication

The system supports `underlying_instrument`, `program_family`, `announcement_of`, `amends`, `supersedes`, `implements`, and explicit identity policies.

### FR-008 Evidence anchoring

Claims link to one or more anchors:

- PDF page and bounding box;
- PDF text span;
- HTML DOM path and quote;
- API response JSON Pointer;
- table cell or row;
- WARC record identifier;
- official document identifier.

### FR-009 Open-world evidence

The absence of a claim does not imply a negative fact. Negative conclusions require an explicit rule or documented search protocol.

### FR-010 Interpretation profiles

Profiles may override permitted policy parameters without changing source evidence. Examples include announcement maturity, collective-action attribution, counteraction precedence, and duplicate handling.

### FR-011 Deterministic receipts

The canonicalized receipt includes:

- result and status;
- proof tree;
- qualifying and excluded actions;
- unresolved and contested claims;
- methodology and evaluator hashes;
- evidence snapshot hash;
- interpretation profile;
- as-of and cutoff times;
- source snapshot identifiers;
- release identifiers where applicable.

### FR-012 Static diagnostics

The compiler and analyzer identify at least:

- missing or conflicting references;
- type and unit mismatches;
- score gaps;
- overlapping score branches;
- unreachable rules;
- missing precedence;
- missing unknown policy;
- undeclared dimensions or partner classes;
- likely duplicate-count risks;
- non-monotonic rules where monotonicity is asserted;
- prose and score-table mismatches recorded as fixtures.

### FR-013 Human review

Every state transition from candidate to accepted evidence is attributable and reversible through a new event, not mutation.

### FR-014 Release diffing

Users can compare methodology, evidence, classifications, and results across releases.

### FR-015 Benchmark reproduction

The system imports the 2025 selected commitments and compares its 160 member-commitment results with the published matrix.

### FR-016 Continuous monitoring

After the benchmark release, configured sources can be monitored for new candidate evidence. Automated updates remain candidates until reviewed.

### FR-017 Report generation

The platform can generate:

- a country assessment;
- a commitment assessment;
- a summit score matrix;
- evidence appendices;
- discrepancy reports;
- machine-readable release bundles.

### FR-018 Public challenge workflow

A third party can submit a source and challenge a claim, classification, or rule. The challenge is versioned and cannot edit the published release directly.

## 5. Non-functional requirements

### NFR-001 Reproducibility

A run is reproducible from checked-in methodology, frozen evidence references, a database snapshot or export, and an evaluator container digest.

### NFR-002 Auditability

All privileged state changes produce append-only audit events.

### NFR-003 Explainability

Every derived predicate and score rule produces an inspectable proof node.

### NFR-004 Integrity

Source objects and release artifacts are hashed. Canonical JSON uses RFC 8785-compatible serialization. Production releases are signed.

### NFR-005 Accessibility

The authoring and public interfaces meet WCAG 2.2 AA targets.

### NFR-006 Internationalization

The data model stores original-language text, normalized text, translations, language tags, and translator provenance separately.

### NFR-007 Performance

Interactive evaluation over one commitment and one member should complete without network access and remain fast enough for editor feedback. Bulk summit runs execute as independent deterministic jobs.

### NFR-008 Portability

Core compilation and evaluation run locally and in CI. No cloud vendor is required for correctness.

### NFR-009 Security

Untrusted documents are never executed. Fetching and extraction are isolated, size-limited, and protected from SSRF, archive bombs, and prompt injection.

### NFR-010 Maintainability

The language, IR, schemas, evaluator, and database each have independent version numbers and explicit migrations.

## 6. Non-goals for the first production release

- Predicting policy outcomes or societal impact.
- Replacing the methodological judgment of the G7 Research Group.
- Fully automatic evidence acceptance or scoring.
- A universal legal reasoning language.
- A graph database as the primary transactional store.
- Full historical backfill before the 2025 benchmark is stable.
- General-purpose web search infrastructure.
- A custom theorem prover.

## 7. Product success measures

### Correctness and coverage

- All published 2025 selected commitments can be represented without arbitrary evaluator plug-ins.
- Every reproduced score has a receipt.
- Every mismatch has a discrepancy record.
- Static analysis catches all seeded rule-gap and overlap fixtures.
- No published result contains an unanchored accepted claim.

### Operational quality

- Deterministic replay passes in CI.
- Source freshness and connector health are measurable.
- Reviewer disagreement and resolution are measurable.
- Analyst actions are attributable.
- Release rollback is possible by selecting a prior immutable release.

### Research value

- Users can compare interpretation profiles.
- Users can identify which hidden methodological assumptions drive score changes.
- The system can distinguish evidence scarcity from policy non-compliance.
