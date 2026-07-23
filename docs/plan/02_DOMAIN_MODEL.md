# Domain Model

## 1. Modeling rule

The model must separate five epistemic layers:

1. **Source**: immutable captured material and metadata.
2. **Fact claim**: a proposition asserted to be supported or contradicted by sources.
3. **Inference**: a deterministic or model-assisted transformation from claims to structured attributes.
4. **Interpretation**: a versioned policy choice about how concepts and evidence should be treated.
5. **Decision**: an accepted classification, score, waiver, or publication action made under a defined authority.

Do not store these layers as one free-text assessment.

## 2. Aggregate roots

### 2.1 Institution

Represents an organization involved in commitment creation, action, evidence, review, or publication.

Fields:

```text
id
canonical_name
aliases[]
institution_type
jurisdiction_id
identifiers[]
valid_time
recorded_time
```

Examples: Government of Canada, European Commission, G7 Research Group, World Bank, a national ministry, a parliamentary body.

### 2.2 Jurisdiction

Represents a country, supranational body, subnational unit, territory, or issue-specific jurisdiction.

Fields:

```text
id
name
jurisdiction_type
parent_id
iso_3166_code
un_m49_code
valid_time
```

### 2.3 Summit

Fields:

```text
id
series
year
host
location
start_date
end_date
members[]
document_ids[]
commitment_ids[]
```

### 2.4 Document

Represents a logical document across versions and formats.

Fields:

```text
id
title
document_type
publisher_id
language
issued_at
official_identifier
canonical_uri
version_ids[]
```

### 2.5 DocumentVersion

Represents immutable content.

Fields:

```text
id
document_id
retrieved_at
media_type
byte_length
sha256
storage_uri
warc_record_id
http_metadata
extraction_status
parser_name
parser_version
```

### 2.6 Passage

A stable anchor into a document version.

Fields:

```text
id
document_version_id
anchor_type
page_number
text_start
text_end
bounding_boxes[]
dom_path
json_pointer
table_coordinates
quote
normalized_quote
anchor_hash
```

Passage anchors must remain valid for the immutable document version. They do not need to survive a new version.

### 2.7 CommitmentCandidate

Represents a source clause being evaluated against commitment-identification criteria.

Fields:

```text
id
summit_id
passage_id
clause_text
features {
  discrete
  specific
  politically_binding
  future_oriented
  collective_intent
}
feature_evidence[]
status
review_ids[]
```

Each feature uses four-valued truth, not a nullable Boolean.

### 2.8 Commitment

The stable identity of an accepted commitment.

Fields:

```text
id
summit_id
canonical_title
issue_areas[]
source_passage_ids[]
subjects[]
accepted_candidate_ids[]
version_ids[]
```

### 2.9 CommitmentVersion

Represents a methodology release for a commitment.

Fields:

```text
id
commitment_id
semantic_version
normative_text
adopted_at
evaluation_window
methodology_bundle_id
definitions[]
dimensions[]
goals[]
partner_classes[]
source_policy_id
status
supersedes_id
```

### 2.10 MethodologyPackage

Fields:

```text
id
package_name
semantic_version
language_version
source_files[]
source_hash
compiled_ir_hash
imports[]
diagnostics[]
signed_by
published_at
```

### 2.11 InterpretationProfile

A named set of policy parameters.

Fields:

```text
id
name
version
base_profile_id
parameters
rationales[]
source_passages[]
status
```

Example parameters:

```text
minimum_implementation_stage
count_collective_actions
collective_action_weight
deduplication_policy
counteraction_precedence
announcement_treatment
pre_compliance_treatment
post_cutoff_discovery_policy
```

### 2.12 SourceRegistryEntry

Fields:

```text
id
name
publisher_id
jurisdictions[]
issue_areas[]
source_tier
source_types[]
base_uri
api_spec_uri
discovery_method
fetch_method
authentication
rate_limit
crawl_schedule
robots_policy
terms_status
languages[]
expected_formats[]
enabled
review_notes
```

### 2.13 SourceFetch

Represents one acquisition attempt.

Fields:

```text
id
source_registry_entry_id
requested_uri
started_at
completed_at
status
http_status
redirect_chain[]
response_headers
error
produced_document_version_ids[]
```

### 2.14 Claim

A proposition about the world.

Fields:

```text
id
claim_type
subject_ref
predicate
object
qualifiers
valid_time
recorded_time
status
origin
created_by
```

Claim types:

```text
fact
negative_search_result
translation
entity_resolution
measurement
relationship
```

Claim status:

```text
candidate
accepted
rejected
contested
superseded
withdrawn
```

### 2.15 EvidenceLink

Links a claim to passages.

Fields:

```text
id
claim_id
passage_id
stance
support_type
relevance
source_tier_at_review
review_status
```

Stance:

```text
supports
contradicts
qualifies
context_only
```

Support type:

```text
direct
derived
corroborating
negative_search
```

### 2.16 Action

Represents a government or attributable action relevant to a commitment.

Fields:

```text
id
canonical_label
actor_ids[]
jurisdiction_id
kind
instrument_type
valid_time
announcement_time
implementation_stage
beneficiaries[]
beneficiary_targeting
resources[]
amounts[]
durability
attribution
geographic_scope
partner_classes[]
program_family_id
underlying_instrument_id
relationship_ids[]
claim_ids[]
status
```

Recommended implementation stages:

```text
proposed
announced
authorized
budgeted
funded
contracted
launched
operational
disbursing
evaluated
completed
suspended
repealed
```

Recommended beneficiary targeting:

```text
explicit
materially_inclusive
indirect
general
absent
contested
```

Recommended durability:

```text
one_off
fixed_term
recurring
institutionalized
unknown
```

Recommended attribution:

```text
unilateral
joint
collective
implementing_partner
external
disputed
```

### 2.17 ActionRelationship

Fields:

```text
id
source_action_id
relationship_type
target_action_or_instrument_id
valid_time
claim_ids[]
```

Relationship types:

```text
announcement_of
implementation_of
funding_for
amends
supersedes
repeals
continues
part_of
duplicate_of
counteracts
```

### 2.18 Classification

Represents a decision that an action satisfies a methodology predicate or category.

Fields:

```text
id
action_id
commitment_version_id
interpretation_profile_id
dimension_id
classification_label
truth_value
proof
status
review_ids[]
```

Classification labels are commitment-defined. Common labels are `strong`, `weak`, `counter`, `excluded`, and `unclassified`.

### 2.19 Review

Fields:

```text
id
object_type
object_id
reviewer_id
decision
rationale
created_at
supersedes_review_id
conflict_of_interest_declaration
```

### 2.20 EvaluationRun

Fields:

```text
id
commitment_version_id
subject_id
interpretation_profile_id
methodology_bundle_hash
evidence_snapshot_id
evaluator_build_id
as_of
cutoff
started_at
completed_at
status
receipt_id
```

### 2.21 EvaluationReceipt

Fields:

```text
id
run_id
result
result_status
confidence
matched_rule_id
proof_tree
qualifying_action_ids[]
excluded_action_ids[]
unresolved_claim_ids[]
contested_claim_ids[]
diagnostics[]
canonical_hash
signature
```

`confidence` is a property of evidence sufficiency or review certainty. It must not alter the published score unless a methodology rule explicitly says so.

### 2.22 Release

Fields:

```text
id
release_name
summit_id
methodology_package_ids[]
evidence_snapshot_id
receipt_ids[]
manifest_hash
signature
published_at
supersedes_release_id
status
```

### 2.23 Discrepancy

Used during benchmark reproduction.

Fields:

```text
id
benchmark_reference
commitment_id
subject_id
published_result
computed_result
category
summary
details
blocking
resolution_status
linked_rule_ids[]
linked_claim_ids[]
```

Categories:

```text
missing_evidence
implicit_interpretation
rule_gap
rule_overlap
prose_metric_mismatch
action_identity_ambiguity
attribution_ambiguity
temporal_ambiguity
extraction_error
published_data_inconsistency
implementation_defect
```

## 3. Temporal model

Use bitemporal semantics.

- **Valid time**: when the source claim, action, or relationship is true in the world.
- **Recorded time**: when the system learned or recorded it.

An action announced before the evaluation window but implemented during it may count under one methodology and not another. An article discovered after the cutoff may still document an action that occurred before the cutoff. These are separate dimensions.

Represent intervals with explicit inclusivity:

```text
[start, end]
[start, end)
(-infinity, end]
[start, +infinity)
```

Do not use a single ambiguous `date` field for announcements, legal effect, disbursement, and publication.

## 4. Quantity model

Quantities must preserve:

```text
numeric_value as exact decimal
unit
currency where applicable
price_basis_date
nominal_or_real
lower_or_upper_bound
approximation_status
source_claim_ids[]
```

Examples:

```text
CAD 300,000,000 maximum_authorization
USD 75,000,000 actual_disbursement
5 partner_classes count
40 percent coverage_ratio
```

Do not convert currencies unless a rule requires aggregation. Keep original values and the conversion source, date, and method.

## 5. Truth and status are different

A proposition can have one of four truth values:

```text
true
false
unknown
contested
```

A record also has a workflow status such as `candidate`, `accepted`, or `rejected`. These must not be conflated.

Examples:

- An accepted claim may assert that a fact is `false`.
- A candidate claim may assert that a fact is `true`, but it has not been reviewed.
- A classification may be accepted as `contested` because authoritative sources conflict.

## 6. Source tier model

Recommended default tiers:

```text
0 original commitment, law, official legal instrument, or official financial record
1 executing government, ministry, regulator, or official program source
2 official oversight, audit, legislature, or court
3 recognized international organization
4 reputable major news organization or wire service
5 issue-specific research organization, academic source, or NGO
6 secondary aggregation, social platform, or unverified lead
```

Tier is not a universal credibility score. A tier 2 audit report may be stronger evidence of non-implementation than a tier 1 press release. The model stores source type and stance in addition to tier.

## 7. Identity and counting

Counting actions is a methodological operation, not a database row count.

The system must support at least four identities:

1. **Announcement identity**: each public announcement.
2. **Instrument identity**: the law, budget line, program, contract, or strategy being announced.
3. **Implementation action identity**: a materially distinct execution step.
4. **Methodology count identity**: the unit that a particular commitment's rules count.

A commitment must declare its count identity or inherit an explicit default. Otherwise the compiler should warn that action splitting can change the score.

## 8. Attribution model

Attribution is not binary. A collective G7 declaration, an EU program, and a national implementing action may each have different relevance to a member score.

Store:

```text
actor
initiator
funding_authority
implementing_authority
beneficiary jurisdiction
collective membership
legal responsibility
methodology attribution decision
```

The interpretation profile decides whether collective or joint actions count and whether they are deduplicated against national implementation.

## 9. Derived views

The database may expose materialized views, but their contents must remain derivable:

- accepted evidence by member and commitment;
- action timelines;
- source coverage matrix;
- current classifications;
- current receipt by profile;
- published benchmark comparison;
- unresolved evidence queue;
- duplicated program families;
- source freshness and connector health.
