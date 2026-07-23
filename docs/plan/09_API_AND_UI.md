# API and User Interface

## 1. API principles

- OpenAPI 3.1 is the contract.
- All writes are authenticated and audited.
- State transitions use explicit commands, not arbitrary record patching.
- Version and release identifiers are immutable.
- Pagination is cursor-based for large collections.
- Every response includes a request identifier.
- Public endpoints expose only releasable source content.

## 2. Resource APIs

### Institutions and jurisdictions

```text
GET  /v1/institutions
GET  /v1/institutions/{id}
GET  /v1/jurisdictions
```

### Summits and commitments

```text
GET  /v1/summits
GET  /v1/summits/{id}
GET  /v1/summits/{id}/commitments
POST /v1/commitment-candidates
POST /v1/commitment-candidates/{id}/review
GET  /v1/commitments/{id}
GET  /v1/commitments/{id}/versions
```

### Methodology

```text
POST /v1/methodology/packages/compile
POST /v1/methodology/packages/analyze
POST /v1/methodology/packages/{id}/approve
GET  /v1/methodology/packages/{id}
GET  /v1/methodology/packages/{id}/diagnostics
GET  /v1/methodology/packages/{id}/source-map
```

Compilation should also work locally through the CLI. The service endpoint exists for Studio.

### Sources and documents

```text
GET  /v1/source-registry
POST /v1/source-registry
POST /v1/source-registry/{id}/validate
POST /v1/source-registry/{id}/fetch
GET  /v1/documents
GET  /v1/documents/{id}
GET  /v1/document-versions/{id}
GET  /v1/document-versions/{id}/passages/{passageId}
```

### Claims and actions

```text
GET  /v1/claims
POST /v1/claims
POST /v1/claims/{id}/submit-review
POST /v1/claims/{id}/accept
POST /v1/claims/{id}/reject
POST /v1/claims/{id}/contest
GET  /v1/actions
POST /v1/actions
POST /v1/actions/{id}/relationships
POST /v1/actions/{id}/submit-review
```

Use idempotency keys for writes.

### Evidence snapshots

```text
POST /v1/evidence-snapshots
GET  /v1/evidence-snapshots/{id}
POST /v1/evidence-snapshots/{id}/freeze
GET  /v1/evidence-snapshots/{id}/manifest
```

### Evaluations and receipts

```text
POST /v1/evaluation-runs
GET  /v1/evaluation-runs/{id}
GET  /v1/receipts/{id}
GET  /v1/receipts/{id}/proof
GET  /v1/receipts/{id}/sources
POST /v1/receipts/{id}/approve
POST /v1/receipts/compare
POST /v1/receipts/verify
```

### Benchmarking

```text
POST /v1/benchmarks/2025/run
GET  /v1/benchmarks/2025/matrix
GET  /v1/benchmarks/2025/discrepancies
POST /v1/discrepancies/{id}/resolve
```

### Releases

```text
POST /v1/releases/build
POST /v1/releases/{id}/approve
POST /v1/releases/{id}/publish
GET  /v1/releases/{id}
GET  /v1/releases/{id}/manifest
GET  /v1/releases/{id}/download
POST /v1/releases/{id}/verify
```

### Challenges

```text
POST /v1/challenges
GET  /v1/challenges/{id}
POST /v1/challenges/{id}/respond
POST /v1/challenges/{id}/resolve
```

## 3. Command semantics

Do not expose `PATCH status=accepted`. Use command endpoints such as `accept`, because each transition has authorization, validation, and audit consequences.

Commands require:

```text
expected_version
reason
idempotency_key
```

Reject stale writes with a conflict response.

## 4. API error format

```json
{
  "type": "https://covenant.example/errors/ambiguous-score",
  "title": "Evaluation cannot select a unique score",
  "status": 409,
  "code": "COV-SCORE-005",
  "detail": "Rules full and countervailing are true at equal priority.",
  "instance": "/v1/evaluation-runs/01...",
  "request_id": "01...",
  "context": {
    "rule_ids": ["full", "countervailing"]
  }
}
```

## 5. Studio information architecture

### 5.1 Workspace selector

Filters:

```text
summit
commitment
member
methodology version
interpretation profile
evidence snapshot
release
```

### 5.2 Methodology editor

Panels:

- literate DSL editor;
- diagnostics list;
- source passage viewer;
- symbol outline;
- normalized score table;
- scenario runner;
- bounded-analysis witnesses;
- package diff and release action.

Clicking a diagnostic highlights the DSL span and any supporting source passage.

### 5.3 Evidence inbox

Columns:

```text
candidate action
member
commitment relevance
source tier
published date
implementation stage candidate
possible duplicate
model extraction confidence
review state
```

Bulk actions may assign reviewers or mark irrelevant. Bulk acceptance of score-decisive facts should be disabled.

### 5.4 Source viewer

Show:

- original document or rendered PDF page;
- highlighted passage;
- source metadata and hash;
- extracted text;
- alternative parser output when relevant;
- linked claims;
- translation and original language;
- archive availability.

### 5.5 Action workbench

Show:

- action fields;
- timeline;
- actor and beneficiary;
- program family and underlying instrument;
- related announcements and implementation steps;
- supporting and contradicting claims;
- possible duplicates;
- classification under each interpretation profile;
- reviewer history.

### 5.6 Score workbench

Show:

- current result and status;
- matched score rule;
- count intervals and coverage;
- qualifying actions;
- excluded actions with reason;
- unknown and contested predicates;
- proof tree;
- counterfactual controls for approved interpretation parameters;
- published benchmark comparison.

A user should be able to answer "what single unresolved question could change this score?"

### 5.7 Release workbench

Show:

- 8 by 20 score matrix;
- previous-release diffs;
- blocking diagnostics;
- unresolved receipts;
- source coverage gaps;
- review quorum;
- release manifest and signature status.

## 6. Public explorer

Pages:

```text
summit overview
commitment overview
member overview
score matrix
individual receipt
source and evidence list
methodology page
release history
challenge submission
```

Public receipt page should lead with the result, then rule, qualifying evidence, exclusions, uncertainty, and methodology. Do not bury uncertainty below narrative prose.

## 7. Visualization requirements

Useful visualizations:

- member by commitment heat map;
- action timeline;
- score proof tree;
- methodology decision table;
- source coverage matrix;
- profile comparison;
- release diff;
- program-family relationship graph.

Every chart must have an accessible table or textual equivalent.

## 8. Editor integration

The Langium language server provides:

- syntax highlighting;
- completion;
- hover documentation;
- go to definition;
- find references;
- rename;
- formatting;
- source-link navigation;
- diagnostics;
- code actions for common fixes;
- scenario execution.

Use Monaco in Studio. A VS Code extension can reuse the same language server later.

## 9. Report generation

Generate a deterministic structured report first:

```text
commitment text
methodology summary
member result
matched rule
accepted strong/weak/counter actions
excluded evidence
unresolved issues
sources
```

Output formats:

```text
HTML
Markdown
JSON
CSV matrix
optionally DOCX/PDF through a separate renderer
```

A generated narrative is always linked to the receipt from which it was produced.

## 10. Permissions

Recommended roles:

```text
viewer
analyst
reviewer
methodologist
source_curator
release_manager
administrator
```

Sensitive operations:

- approving methodology;
- accepting score-decisive claims;
- resolving contested identity;
- waiving blocking diagnostics;
- publishing a release;
- rotating signing keys.

Use separation of duties for final releases.
