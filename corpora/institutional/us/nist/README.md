# NIST institutional corpus

This draft corpus contains 20 atomic NIST institutional records. Fourteen records
are approved and six records remain superseded review history. Record approval does not publish
the corpus.

Stage A preserved identity, organizational placement, NIST’s source-reported mission, and two AI
Standards and Guidelines Group functions from the two initial sources. Its six records, two Core
links, eight accepted judgments, evidence passages, hashes, review states, and provenance remain
unchanged in substance.

Stage B adds exactly nine human-approved records: one narrow statutory mandate, one NVLAP accreditation
decision right, identity and placement for the AI Standards and Guidelines Group, and five
operational capacities covering the laboratory network, Advanced Measurement Laboratory, NVLAP
program machinery, AI measurement work, and the AI Consortium. The NVLAP decision right records
the determination NIST may make; the capacity record separately describes the machinery used to
administer accreditation. Sara Kim approved all nine additions on 2026-08-08 after reviewing their
assertions, fact payloads, evidence passages, uncertainties and proposed dispositions. The original
automated proposal phase remains recorded separately in the review queue and migration ledger.

A follow-up human review on 2026-08-29 superseded `nist_lab_network_capacity` without deleting it.
Its approved successor, `nist_lab_network_capacity_v2`, preserves the same evidence, passage, fact
type, uncertainty and operational-capacity meaning while removing only the unsupported modifier
“principal.” The directed Core supersession link and paired judgment history make the correction
explicit.

The same review completed the three remaining semantic decisions. The approved
`nist_ai_standards_group_placement_v2` retains the placement while marking its two-passage support
as inferred. `nist_aml_facility_capacity_v2` retains the direct facility-capacity evidence and
uncertainty while limiting its assertion to the documented physical features. The atomic
`nist_ai_measurement_function` replaces the too-strong capacity classification with only the
Division’s directly stated AI measurement-science, testing/evaluation and standards work. The
separate named-groups passage remains preserved in the source ledger, historical capacity record,
and existing group records rather than being forced into the function successor.

Official source identities, URLs, retrieval and version metadata, and pinned document hashes are
registered in `sources.writ`. Each record embeds its exact supporting passage, narrow locator,
passage hash, document hash, evidence basis, uncertainty, review state, and provenance. Raw HTML
webpage captures are not tracked; Writ preserves the structured evidence contract rather than
serving as a web archive. The two Stage A source identities and their document hashes were not
replaced or mutated.

The maintainer's explicit human disposition on 2026-09-04 approves
`nist_nvlap_lab_decision_right_v2` with the same scoped assertion and corrected Handbook evidence:
the complete three-sentence clause 1.3.5 and only sentence 1 of clause 3.5.3. New passage identities
preserve the approved extents; the old record, passage representations and Sara Kim's original
approval remain superseded history. The frozen PDF and its source/version identities are unchanged.
The exact disposition and extraction evidence are retained in
`docs/migrations/nist-handbook-competence/`.

Workforce, budget, AI-budget, degraded-facility, generic operating-status, AI-group mission, and
Director decision-right proposals were intentionally not added. Their absence is not a false value.
External consortium resources remain external and are never represented as NIST-owned resources.

The registered U.S. Code source version is the official OLRC preliminary text containing laws in
effect on August 7, 2026. The exact § 272(b)(2) quotation and passage hash are unchanged from the
prior annual-edition capture; the pinned document hash and original retrieval transport are
recorded in `migration.yaml`. The complete Stage A and Stage B history is in `migration.yaml` and
`docs/migrations/institutional-stage-b/human-review.yaml`; accepted human dispositions are in
`judgments.writ`. The seven Core links are stored only in their authoritative direction, and
inverse links are derived rather than stored.
