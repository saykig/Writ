# NIST and European Commission institutional Stage B implementation

This report is the implementation and pull-request record for work based on
`14ec512a28949155054dd2e7479337dbfce95f8c`, the current `origin/main` and merge commit for PR #10.
The machine-readable pre-edit inventory is `pre-implementation-inventory.json`.

## Correction outcome and human-review provenance

The automated proposal phase remains inspectable in `review-queue.yaml`, ID
`institutional-stage-b-review-queue-v1`, and both corpus migration ledgers. Sara Kim subsequently
completed human review on 2026-08-08. The authoritative durable decision artifact is
`human-review.yaml`:

- the eight NIST Stage A judgments remain accepted by Sara Kim and are byte-preserved;
- all nine active NIST Stage B targets are approved with accepted human dispositions;
- all 20 Commission records and its one active Core link are approved with accepted human
  dispositions;
- all 30 decisions record review of the target assertion, fact or link payload, selected evidence
  passages, uncertainties and proposed disposition;
- omission of `eu_ai_office_model_eval_capacity` is explicitly approved because current evidence
  does not independently establish concrete operational machinery.

The accepted judgments identify Sara Kim as reviewer. Codex remains identified only as the author
of the earlier automated proposals; no human approval is attributed to automation.

## Preservation results

NIST Stage A remains six records (five approved and one superseded), two approved Core links and
eight accepted judgments. Every protected Stage A record ID, assertion, review state, provenance
field, evidence locator, quotation, passage hash and document hash matches the pre-implementation
inventory. Both Stage A relationship files remain byte-identical, the first eight judgments remain
the exact accepted human dispositions, and the first eight migration entries are unchanged.

The three Commission baseline records retain their IDs, assertions, fact payloads, subjects, scope,
conditions, evidence IDs, locators, quotations, passage hashes, document hashes, creation
provenance; their workflow states now reflect the completed human approval. The shared AI Act source and passage registries remain
byte-identical, with SHA-256 values
`cff778809423fbaf6e428565a7bc56df1dca583c3de91c1fdce2a09c8cf2aa72` and
`a4493f8821a66184708fcb6003a8293693a2061d38763b7f0e8b779db4c2608f`.

No accepted legal-policy record, quoted evidence passage, passage locator, passage hash or archive
artifact was changed by the correction. The § 272 capture, source URL, retrieval timestamp and
source-document hash were deliberately replaced as described below. Unrelated social-preview
metadata and its image were removed from this PR; the generated corpus-catalog projection remains.

## Official sources and statutory currency

All Stage B captures remain in their corpus-local `sources/captures/` directories with their
complete stored-document hashes. The former 2024-edition GovInfo § 272 PDF was replaced by a
captured current official OLRC page whose own header states that it contains laws in effect on
August 7, 2026. Direct origin access timed out from the capture environment, so the stored HTML was
retrieved through a Google Translate pass-through that detected English; the capture retains the
canonical OLRC URL and transport metadata. This transport fact is recorded in `migration.yaml`
rather than hidden.

Direct OLRC retrieval was retried during human-review application and again timed out. A fresh
pass-through replay was then compared with the stored capture. The canonical URL metadata,
laws-in-effect date, selected passage and substantive OLRC content are byte-identical; differences
are limited to volatile JSF session/ViewState and Google transport-configuration values. The
publisher remains the Office of the Law Revision Counsel, not the transport provider.

The stored § 272 document hash is
`sha256:456fb61742da7ee5e996116af634ca569955a3319429027aed083903d41bcb7d`.
The exact § 272(b)(2) quotation is byte-identical to the prior annual-edition quotation, so its
recalculated passage hash remains
`sha256:7b5d22a2d42aa1f5b42b3d1b32e4a2fca3c6640db6467adb2dd2cb3a48e8a019`.
The assertion, scope and uncertainty claim currency only through the date stated by the stored
OLRC capture. Other NIST sources remain 15 CFR Part 285, NIST Handbook 150, and the official NIST
accreditation, laboratories, AML, AI division and AI Consortium pages. Commission sources remain
TEU Articles 13 and 17, TFEU Article 258, Commission Decision C/2024/1459, and official
Commission, AI Office and JRC pages.

The deterministic Mapbox-token sanitization remains unchanged. Six NIST HTML captures retain the
fixed `[REDACTED_PUBLISHER_MAPBOX_TOKEN]` replacement, original URLs and retrieval dates, pre/post
hash ledger, zero selected-evidence intersections and byte-identical evidence quotations. The
stored post-sanitization hashes remain the authoritative document hashes. No credential is stored
or approved through secret scanning.

## Human-approved NIST Stage B records

NIST still has exactly nine Stage B additions:

| Record | Fact type | Workflow result |
| --- | --- | --- |
| `nist_national_measurement_standards_mandate` | mandate | approved; current OLRC scope explicit through 2026-08-07 |
| `nist_nvlap_lab_decision_right` | decision right | approved |
| `nist_ai_standards_group_identity` | identity | approved |
| `nist_ai_standards_group_placement` | placement | approved; immediate parent preserved |
| `nist_lab_network_capacity` | operational capacity / laboratory network | approved; components narrowed |
| `nist_aml_facility_capacity` | operational capacity / facility | approved |
| `nist_nvlap_accred_capacity` | operational capacity / accreditation system | approved; components narrowed |
| `nist_ai_measurement_capacity` | operational capacity / organizational unit | approved; NIST holder and scoped implementing division preserved |
| `nist_ai_consortium_capacity` | operational capacity / partnership network | approved; mechanisms narrowed |

The AI Standards and Guidelines Group placement now uses the directly evidenced parent
`nist.ai_research_measurement_standards_division`; NIST remains the root institution in scope.

## Human-approved Commission Stage B records and link

The Commission corpus contains 20 approved records: the three preserved baseline functions and 17
records introduced through the automated proposal phase. The reasoned-opinion record is
`european_commission_reasoned_op_function`. It preserves Article 258’s conditional mandatory
modality: once the Commission considers that a Member State failed to fulfil a Treaty obligation
and has allowed observations, Article 258 requires delivery of a reasoned opinion. The automated
proposal classified that duty as a function, distinct from the discretionary CJEU-referral
decision right, and human review approved that classification.

The AI Office placement now uses the directly evidenced parent `european_commission.dg_connect`.
The root traversal link is renamed to
`eu_ai_office_european_commission_relationship`, has `basis: inherited`, and is supported by the
direct placement record. No typo alias is preserved because the previous ID was an unpublished
draft with no external consumer. No inverse link is stored.

The separate AI Office model-evaluation function and Article 92 decision-right records remain.
`eu_ai_office_model_eval_capacity` remains absent under an explicit `approve_omission` decision:
its passages establish assigned work, legal authority and a publisher claim of expertise, but not
concrete organizational or technical machinery.

## Approved ID revisions

Human review approved six identifier revisions. All active references, judgments, audits,
inventories, generated projections and tests use the approved IDs; the previous draft IDs remain
only in explicit migration history:

| Previous draft ID | Approved ID |
| --- | --- |
| `eu_ai_office_training_summary_template_function` | `eu_ai_office_training_sum_temp_function` |
| `european_commission_budget_management_function` | `european_commission_budget_mgmt_function` |
| `european_commission_reasoned_opinion_function` | `european_commission_reasoned_op_function` |
| `european_commission_cjeu_referral_decision_right` | `european_commission_cjeu_refer_decision_right` |
| `nist_laboratory_network_capacity` | `nist_lab_network_capacity` |
| `nist_nvlap_accreditation_capacity` | `nist_nvlap_accred_capacity` |

## Capacity evidence correction

`capacity-evidence-audit.yaml`, ID `institutional-stage-b-capacity-evidence-audit-v1`, maps every
retained status, capacity type and component to a passage cited by that record and an exact fragment
of its quotation. Tests verify every mapping against compiled evidence. No active capacity payload
retains `quantity` or `as_of_date`: quoted counts remain visible in assertions and passages, but the
quotations do not state a calendar date from which to construct a directly supported as-of value.

Changes made solely for evidence precision:

| Record | Removed or changed | Directly supported retained values |
| --- | --- | --- |
| `nist_lab_network_capacity` | Removed six uncited laboratory names; removed normalized quantity/date | `six_laboratories`, `user_facilities` |
| `nist_nvlap_accred_capacity` | Removed unsupported `continuing_assessment`; renamed `application_processing` to quoted `application_submission` | application submission, on-site assessment, nonconformity resolution, proficiency testing, technical evaluation, certificate/scope issuance |
| `nist_ai_measurement_capacity` | Changed type from `technical_capability` to `organizational_unit`; removed `technical_guidance` and unsupported machinery inference; NIST is the holder and the AI division remains in scope as the implementing unit | AI measurement science, testing/evaluation, standards, and the two named groups |
| `nist_ai_consortium_capacity` | Removed CRADA, task-group, prototype-evaluation and technology-transfer mechanisms; removed normalized quantity/date | research partnership, external expertise/products/data/models, AI-measurement guidelines and standards |
| `eu_ai_office_org_capacity` | Removed uncited unit/adviser names and normalized quantity/date | six generic units and two generic advisers; the assertion preserves the quoted staff threshold |
| `eu_ai_office_cooperation_capacity` | Removed unsupported international-cooperation component and split platform overclaims | Commission services, Union bodies, Member State authorities, dedicated expert/stakeholder platforms, scientific experts and AI developers |
| `eu_ai_office_model_eval_capacity` | Human review approved omission because current evidence does not establish concrete operational machinery | approved function and decision-right records remain |
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
- the completed human review establishes reviewed evidence-to-schema mappings and bounded
  **semantic interoperability** for these records;
- full institutional equivalence is not claimed beyond the documented mappings and limitations.

Federal, supranational and organizational-unit identities remain distinct. Direct and inherited
relationships remain distinct. Accreditation machinery, physical infrastructure, organizational
structure and partnership networks are not flattened merely because they share an operational-
capacity envelope.

## Final counts

| Corpus | Records | Record links | Accepted judgments | Proposed judgments | Record workflow |
| --- | ---: | ---: | ---: | ---: | --- |
| NIST | 15 | 2 | 17 | 0 | 14 approved, 1 superseded; 2 approved links |
| European Commission | 20 | 1 | 21 | 0 | 20 approved records, 1 approved link |

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
