# Security, Governance, and Responsible Automation

## 1. Threat model

The system ingests untrusted public content, runs parsers and browser automation, uses models for candidate extraction, stores politically sensitive judgments, and publishes auditable results. Treat all external content as hostile.

Primary threats:

- server-side request forgery through crawler URLs;
- malicious PDFs, archives, office files, and embedded scripts;
- browser exploitation and cross-site data leakage;
- prompt injection in source documents;
- model hallucination or unsupported extraction;
- evidence tampering or deletion;
- unauthorized claim acceptance or score publication;
- compromised dependencies, containers, or CI workflows;
- secrets leakage through logs or model requests;
- cross-tenant data exposure if multiple research teams use the platform;
- copyright or terms-of-use violations;
- political pressure to silently alter methodology or evidence;
- denial of service through large files or crawl traps;
- replay of stale connector cursors or duplicate writes;
- malicious challenge submissions.

## 2. Trust boundaries

```text
Internet and source systems
  | untrusted
Fetch sandbox
  | sanitized artifacts, still untrusted content
Extraction sandbox
  | structured candidates
Review boundary
  | accepted evidence
Deterministic evaluator
  | receipt
Release approval boundary
  | published artifact
Public users
```

A source becoming structured does not make it trusted. Acceptance is a governance event.

## 3. Fetch and extraction isolation

- Run crawlers and parsers in isolated containers or sandboxes.
- Deny access to metadata services, internal networks, and privileged sockets.
- Use per-connector egress allowlists where practical.
- Limit CPU, memory, disk, wall time, page count, recursion, and decompressed size.
- Disable macros and active content.
- Render JavaScript pages in disposable browser contexts.
- Never open source attachments in a privileged analyst desktop automatically.
- Quarantine malformed or suspicious artifacts.

## 4. Prompt-injection controls

Source text is data. Model system instructions must state that commands, role changes, secrets requests, and tool instructions found in a source are not authoritative.

Model-assisted extraction:

- has no write access to accepted evidence;
- has no access to signing keys;
- cannot call the evaluator publication endpoint;
- receives only the minimum source passages required;
- returns schema-constrained candidates;
- must cite passage IDs for every proposed field;
- is logged by model and prompt version;
- is tested against an adversarial document corpus.

Do not use a browsing model as both source collector and final scoring authority.

## 5. Authorization

Use OIDC and short-lived sessions. Authorization is role and object scoped.

Examples:

- an analyst may create claims but not approve their own score-decisive claim;
- a methodologist may approve methodology but not sign a release alone;
- a source curator may enable connectors but not accept evidence;
- an administrator may manage accounts but cannot alter release history.

Use row-level security or equivalent for separate workspaces.

## 6. Separation of duties

Recommended release controls:

```text
methodology approved by methodologist
score-decisive evidence approved by reviewer
receipt approved by reviewer or lead
release manifest approved by release manager
signature created by protected signing identity
```

For small teams, one person may hold multiple roles, but the system records role changes and conflicts of interest.

## 7. Audit and immutability

- Accepted records are superseded, not edited in place.
- Audit events are append-only.
- Release object versions are immutable.
- Object storage uses versioning and retention for released artifacts.
- Database backups and audit exports are independently retained.
- Every privileged command requires a reason.

## 8. Cryptographic integrity

- SHA-256 content hashes.
- Canonical JSON before hashing.
- Signed methodology bundles and release manifests.
- Public verification command and documented key rotation.
- Optional timestamp authority for high-assurance publication.
- Store signer, key identifier, algorithm, and verification status.

Signatures prove artifact integrity and publisher identity. They do not prove methodological correctness.

## 9. Data classification

Suggested classes:

```text
public source content
public derived data
internal workflow data
restricted licensed source content
personal data in reviews or challenges
secrets and credentials
signing material
```

Public-source research can still contain personal data. Minimize collection and restrict unnecessary identifiers.

## 10. Copyright and source rights

- Preserve attribution and canonical links.
- Store full content only where permitted for research and audit.
- Public release bundles should generally contain metadata, hashes, short passages, and links rather than redistributed full media articles.
- Record license and terms status per source registry entry.
- Support metadata-only evidence records for licensed or restricted material.
- Honor takedown and correction processes without destroying released audit history. A public view can be withdrawn while a protected audit record remains.

## 11. Responsible model use

Permitted model roles:

- candidate commitment extraction;
- candidate action extraction;
- source relevance ranking;
- entity and duplicate candidate generation;
- translation draft;
- prose and rule discrepancy suggestions;
- narrative draft from a fixed receipt.

Prohibited autonomous roles:

- accepting evidence;
- resolving contested claims;
- choosing an interpretation profile;
- waiving compiler diagnostics;
- publishing a score;
- modifying signed releases.

## 12. Model evaluation

Maintain labelled datasets for:

- action extraction precision and recall;
- implementation-stage extraction;
- amount and date extraction;
- source-passage grounding;
- duplicate candidate retrieval;
- prompt-injection resistance;
- multilingual translation accuracy;
- unsupported-field rate;
- politically asymmetric error rate across members.

Measure extraction quality by field and issue area. An overall score can hide decisive failures.

## 13. Bias and political neutrality

Neutrality is a process property, not an absence of judgment.

Controls:

- same source and review policy across members;
- visible exceptions and rationales;
- cross-member calibration sessions;
- blinded review where practical for edge-case classification;
- profile comparison;
- reviewer disagreement metrics;
- published discrepancy and correction history;
- no hidden member-specific thresholds.

## 14. Dispute governance

A dispute can target:

```text
source authenticity
claim accuracy
action identity
attribution
classification
methodology rule
interpretation profile
score derivation
report wording
```

Dispute states:

```text
submitted
triaged
under_review
accepted
rejected
partially_accepted
resolved_in_new_release
```

A dispute outcome links to affected records and any superseding release.

## 15. Availability and recovery

- Automated database backups.
- Object-store versioning.
- Restore tests.
- Exportable release bundles independent of the live platform.
- Graceful degradation: local compiler and evaluator remain usable during connector outages.
- Public receipt verification does not depend on a mutable database.

## 16. Secure development lifecycle

- Threat model reviewed with each major architecture change.
- Dependency and container scanning.
- Static analysis and secret scanning.
- Code review for evaluator, compiler, schema, authorization, and signing changes.
- Property and mutation tests for score logic.
- Fuzz parser and document boundaries.
- Security tests for SSRF, XSS, injection, object-level authorization, and file handling.
- SBOM and signed release artifacts.

## 17. Governance documents required before public launch

- methodology approval policy;
- evidence and source policy;
- reviewer handbook;
- conflict-of-interest policy;
- correction and retraction policy;
- public challenge policy;
- model-use policy;
- source copyright and retention policy;
- security incident process;
- signing-key policy;
- release checklist.
