# NIST and European Commission institutional Stage B implementation

This report is the implementation and pull-request record for work based on
`14ec512a28949155054dd2e7479337dbfce95f8c`, the current `origin/main` and merge commit for PR #10.
The machine-readable pre-edit inventory is `pre-implementation-inventory.json`.

## Correction outcome and human-review provenance

No complete Stage B human-approval matrix or record-by-record approval artifact exists in the
repository, Git history, PR conversation or review threads. The earlier branch state incorrectly
attributed 31 accepted dispositions to Sara Kim. The correction applies the automated-proposal
path:

- the eight NIST Stage A judgments remain accepted by Sara Kim and are unchanged;
- the nine NIST Stage B records are `draft`, with nine `proposed` dispositions by
  `OpenAI Codex automated proposal`;
- the three pre-existing Commission functions remain `draft`;
- the Commission corpus contains 20 active draft records and one draft link, with 21 proposed
  dispositions by the automated proposer;
- the AI Office model-evaluation capacity candidate is omitted pending stronger evidence, so there
  are 30 active Stage B proposed judgments rather than 31 accepted judgments.

The stable pending-review artifact is `review-queue.yaml`, ID
`institutional-stage-b-review-queue-v1`. It groups every active proposal by atomic schema and gives
the exact target, proposed judgment and selected passage IDs. It also records the omitted capacity
candidate. A human must review each target’s assertion, fact payload, evidence, uncertainties and
disposition before any proposal can become accepted.

## Preservation results

NIST Stage A remains six records (five approved and one superseded), two approved Core links and
eight accepted judgments. Every protected Stage A record ID, assertion, review state, provenance
field, evidence locator, quotation, passage hash and document hash matches the pre-implementation
inventory. Both Stage A relationship files remain byte-identical, the first eight judgments remain
the exact accepted human dispositions, and the first eight migration entries are unchanged.

The three Commission baseline records retain their IDs, assertions, fact payloads, subjects, scope,
conditions, evidence IDs, locators, quotations, passage hashes, document hashes, creation
provenance and original `draft` state. The shared AI Act source and passage registries remain
byte-identical, with SHA-256 values
`cff778809423fbaf6e428565a7bc56df1dca583c3de91c1fdce2a09c8cf2aa72` and
`a4493f8821a66184708fcb6003a8293693a2061d38763b7f0e8b779db4c2608f`.

No accepted legal-policy record, source capture, source URL, retrieval timestamp, quoted evidence
passage, passage locator, passage hash, source-document hash, archive artifact or frontend behavior
was changed by the correction.

## Official sources and statutory currency

All Stage B captures remain in their corpus-local `sources/captures/` directories with their
complete stored-document hashes. The NIST sources are the 2024-edition GovInfo section PDF, 15 CFR
Part 285, NIST Handbook 150, and the official NIST accreditation, laboratories, AML, AI division
and AI Consortium pages. Commission sources are TEU Articles 13 and 17, TFEU Article 258,
Commission Decision C/2024/1459, and official Commission, AI Office and JRC pages.

The stored statutory capture is now identified strictly as the **2024 edition** of 15 U.S.C.
§ 272. The mandate assertion, scope, uncertainty and source version do not claim that retrieval on
2026-08-05 proves later statutory currency. The earlier report’s unrecorded “current OLRC text was
checked” statement was removed; no unstored check is treated as durable provenance.

The deterministic Mapbox-token sanitization remains unchanged. Six NIST HTML captures retain the
fixed `[REDACTED_PUBLISHER_MAPBOX_TOKEN]` replacement, original URLs and retrieval dates, pre/post
hash ledger, zero selected-evidence intersections and byte-identical evidence quotations. The
stored post-sanitization hashes remain the authoritative document hashes. No credential is stored
or approved through secret scanning.

## Corrected NIST proposals

NIST still has exactly nine Stage B additions:

| Record | Fact type | Workflow result |
| --- | --- | --- |
| `nist_national_measurement_standards_mandate` | mandate | draft proposal; 2024-edition scope explicit |
| `nist_nvlap_lab_decision_right` | decision right | draft proposal |
| `nist_ai_standards_group_identity` | identity | draft proposal |
| `nist_ai_standards_group_placement` | placement | draft proposal; immediate parent corrected |
| `nist_laboratory_network_capacity` | operational capacity / laboratory network | draft proposal; components narrowed |
| `nist_aml_facility_capacity` | operational capacity / facility | draft proposal |
| `nist_nvlap_accreditation_capacity` | operational capacity / accreditation system | draft proposal; components narrowed |
| `nist_ai_measurement_capacity` | operational capacity / organizational unit | draft proposal; type and components narrowed |
| `nist_ai_consortium_capacity` | operational capacity / partnership network | draft proposal; mechanisms narrowed |

The AI Standards and Guidelines Group placement now uses the directly evidenced parent
`nist.ai_research_measurement_standards_division`; NIST remains the root institution in scope.

## Corrected Commission proposals

The Commission corpus now contains 20 active draft records: the three preserved baseline functions
and 17 new proposals. The reasoned-opinion record is now
`european_commission_reasoned_opinion_function`. It preserves Article 258’s conditional mandatory
modality: once the Commission considers that a Member State failed to fulfil a Treaty obligation
and has allowed observations, Article 258 requires delivery of a reasoned opinion. The automated
proposal classifies that duty as a function, distinct from the discretionary CJEU-referral decision
right. No human classification rationale exists yet; the queue requires one before approval.

The AI Office placement now uses the directly evidenced parent `european_commission.dg_connect`.
The root traversal link is renamed to
`eu_ai_office_european_commission_relationship`, has `basis: inherited`, and is supported by the
direct placement record. No typo alias is preserved because the previous ID was an unpublished
draft with no external consumer. No inverse link is stored.

The separate AI Office model-evaluation function and Article 92 decision-right records remain.
`eu_ai_office_model_eval_capacity` is omitted because its passages establish assigned work, legal
authority and a publisher claim of expertise, but not concrete organizational or technical
machinery.

## Capacity evidence correction

`capacity-evidence-audit.yaml`, ID `institutional-stage-b-capacity-evidence-audit-v1`, maps every
retained status, capacity type and component to a passage cited by that record and an exact fragment
of its quotation. Tests verify every mapping against compiled evidence. No active capacity payload
retains `quantity` or `as_of_date`: quoted counts remain visible in assertions and passages, but the
quotations do not state a calendar date from which to construct a directly supported as-of value.

Changes made solely for evidence precision:

| Record | Removed or changed | Directly supported retained values |
| --- | --- | --- |
| `nist_laboratory_network_capacity` | Removed six uncited laboratory names; removed normalized quantity/date | `six_laboratories`, `user_facilities` |
| `nist_nvlap_accreditation_capacity` | Removed unsupported `continuing_assessment`; renamed `application_processing` to quoted `application_submission` | application submission, on-site assessment, nonconformity resolution, proficiency testing, technical evaluation, certificate/scope issuance |
| `nist_ai_measurement_capacity` | Changed type from `technical_capability` to `organizational_unit`; removed `technical_guidance` and unsupported machinery inference | AI measurement science, testing/evaluation, standards, and the two named groups |
| `nist_ai_consortium_capacity` | Removed CRADA, task-group, prototype-evaluation and technology-transfer mechanisms; removed normalized quantity/date | research partnership, external expertise/products/data/models, AI-measurement guidelines and standards |
| `eu_ai_office_org_capacity` | Removed uncited unit/adviser names and normalized quantity/date | six generic units and two generic advisers; the assertion preserves the quoted staff threshold |
| `eu_ai_office_cooperation_capacity` | Removed unsupported international-cooperation component and split platform overclaims | Commission services, Union bodies, Member State authorities, dedicated expert/stakeholder platforms, scientific experts and AI developers |
| `eu_ai_office_model_eval_capacity` | Removed active record and proposed judgment pending stronger evidence | separate function and decision right remain |
| `european_commission_jrc_infra_capacity` | Removed normalized quantity/date only | all five quoted infrastructure fields remain |

The AML facility components were already directly supported and remain unchanged.

## Interoperability result

The human-readable `interoperability-matrix.md` and machine-readable
`interoperability-matrix.json` (`institutional-stage-b-interoperability-v1`) cover identity,
placement, relationship, mission, mandate, function, decision right and operational capacity. Each
row records the shared definition, NIST and Commission examples, authority types, mapping rationale,
equivalent concepts, analogous-only concepts, differences, uncertainty, schema result and exposed
limitations.

The result is deliberately bounded:

- shared compilation and schema validation establish **structural interoperability**;
- reviewed evidence-to-schema mappings establish **semantic interoperability**;
- the current mappings are automated proposals pending human review, so full semantic
  interoperability is not claimed.

Federal, supranational and organizational-unit identities remain distinct. Direct and inherited
relationships remain distinct. Accreditation machinery, physical infrastructure, organizational
structure and partnership networks are not flattened merely because they share an operational-
capacity envelope.

## Final counts

| Corpus | Records | Record links | Accepted judgments | Proposed judgments | Record workflow |
| --- | ---: | ---: | ---: | ---: | --- |
| NIST | 15 | 2 | 8 Stage A | 9 Stage B | 5 approved, 1 superseded, 9 draft |
| European Commission | 20 | 1 | 0 | 21 | 20 draft records, 1 draft link |

Both corpus manifests remain `status: draft`.

After incorporating current `origin/main`, the deterministic web corpus-catalog projection was
regenerated from these corrected manifests. This synchronizes displayed record counts only; it
does not change interface behavior or corpus semantics.

## Validation

The correction is checked by:

- `bun run format`, `bun run lint`, `bun run typecheck`, `bun run test`, `bun run conformance`, and
  `bun run build`;
- `python internal/tooling/scripts/validate_pack.py` and source-registry drift validation;
- Ruff, mypy and Python tests under `apps/ingest` and `internal/verification`;
- target resolution, judgment supersession, record-link validation, exact source/passage hashes,
  capacity-component passage mapping, credential absence, Stage A preservation, legal-policy byte
  stability, archive checksums and root tracked-tree integrity.

All listed checks pass, including 138 conformance cases and 166 Python tests. PR #11 remains a
draft and is not merged.
