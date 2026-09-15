# NIST proving-ground audit

Audit base: `cc9dec9f0e9ec5692afec087e1fd16df5db8706c` (2026-08-22)

This report precedes any semantic record or institutional-schema change made during NIST
proving-ground hardening. It audits the original 15 institutional records, 2 record links, 17 review
judgments, 11 structured source registrations and the generic compiler, data-bundle and verifier.
NIST is the development proving ground; retained secondary corpora were not used to propose new
semantics.

The follow-up human review completed on 2026-08-29 adds four reviewed successors, four directed
supersession links and eight judgments. The separate Handbook evidence review on 2026-09-04
adds one successor, one directed supersession link and two judgments. The current inventory is
20 records, 7 links and 29 judgments. The exact maintainer disposition is retained in
`docs/migrations/nist-handbook-competence/human-review.yaml`.

## Result

Fourteen records are active and approved. Six records are intentionally retained as superseded
history. All fourteen approved records are clearly supported at their present fact type and
evidence basis after human review resolved the three remaining direct-versus-inferred and capacity
boundaries and the maintainer affirmed the scoped NVLAP assertion with corrected Handbook
evidence. The unsupported modifier **principal** remains visible only in the superseded
`nist_lab_network_capacity`; the active `nist_lab_network_capacity_v2` removes it. The superseded
`nist_measurement_science_function` remains a preserved example of a category error, not an active
fact.

The human-review rationale is explicit: “The cited passage establishes six NIST labs and user
facilities but does not establish that they are NIST’s principal or primary facilities.”

Every evidence quotation reproduces its declared passage hash: 30 evidence occurrences covering
20 unique passages from 10 sources. Hash consistency alone does not establish source wording: the
old competence quotation remains intact only in superseded history. Both retained non-HTML captures
reproduce their document hashes. All 20 records have explicit uncertainty and provenance. Every
active record has an accepted human-review judgment: thirteen by Sara Kim and the NVLAP successor
by the maintainer supplying the 2026-09-04 disposition. Seven replaced approval judgments remain
superseded history. All seven links also have accepted review judgments.

The separately authorized binding application adds two `0.3.0` successor judgments in
`review-binding-judgments.writ`, one for the NVLAP record and one for its directed link. Both bind
the unchanged original human-review artifact at SHA-256
`75e67171bd28d33e623b8079ae20fb6c92dd7ba7b984c8ddbf8ee940fcd0f713`. Their two unbound predecessors
retain all content with retirement metadata; the earlier Sara Kim lineage is unchanged. The new
authorization is recorded in `docs/migrations/nist-handbook-competence/review-binding-human-disposition.yaml`.
This establishes content association without authenticating a reviewer or automating semantic review.

The structured evidence is sufficient to inspect why each record exists without restoring raw
HTML. It does not make Writ an offline web archive: for retired HTML captures, a reviewer cannot
recompute the whole-document hash from tracked bytes. The exact selected quotation, passage hash,
source URL, retrieval/version metadata and recorded document hash remain available.

## Record-by-record findings

`Evidence` names the canonical source and selected passage. Exact passage text is in the passage
ledger below. `Links` lists only stored supporting relationships; an empty entry is meaningful.

| Record | Fact type / state | Assertion audit | Evidence / basis | Uncertainty and provenance | Links | Finding |
| --- | --- | --- | --- | --- | --- | --- |
| `nist_identity` | identity / approved | Names NIST; makes no authority claim. | `nist.about` / `nist.about.identity` / direct | Explicitly excludes mandate, rights, authority and capacity. Automated draft; accepted human judgment. | — | Clear. |
| `nist_organizational_placement` | placement / approved | “Part of” directly supports placement in Commerce; it does not establish authority. | `nist.about` / `nist.about.identity` / direct | Explicitly excludes Commerce decision rights, independence and capacity. Automated draft; accepted human judgment. | Supports `nist_department_of_commerce_relationship`. | Clear. |
| `nist_mission` | mission / approved | Faithfully reports text explicitly labelled as NIST's mission. | `nist.about` / `nist.about.mission` / direct | Explicitly excludes statutory mandate, performance, staffing, funding and capacity. Human-review implementation; accepted human judgment. | Source of the supersession link. | Clear. |
| `nist_measurement_science_function` | function / superseded | Mission text was mislabeled as a function. The assertion is plausible language but the cited passage authoritatively labels itself mission. | `nist.about` / `nist.about.mission` / direct | Ambiguity is recorded. Original automated provenance and accepted superseding disposition are preserved. | Target of `nist_mission_supersedes_nist_measurement_science_function`. | Unsupported classification, correctly inactive and retained as history. |
| `nist_ai_standards_development_function` | function / approved | The passage directly describes activity led by the group; it does not establish mandate or binding power. | `nist.ai_standards_group` / `nist.ai_standards_group.standards` / direct | Explicitly excludes mandate, external authority, regulatory power and capacity. Automated draft; accepted human judgment. | — | Clear. |
| `nist_ai_technical_guidance_function` | function / approved | The passage directly describes development of resources and guidelines. | `nist.ai_standards_group` / `nist.ai_standards_group.guidance` / direct | Explicitly excludes legal force, external authority and capacity. Automated draft; accepted human judgment. | — | Clear. |
| `nist_national_measurement_standards_mandate` | mandate / approved | The statute assigns a narrow responsibility to NIST; mandate is the stronger classification warranted by this authority source. | `us_code.title15_usc_272` / `us_code.title15_usc_272.b_2` / direct | Currency is bounded to laws in effect on 2026-08-07; general regulatory authority is excluded. Automated proposal; accepted human judgment. | — | Clear. |
| `nist_nvlap_lab_decision_right` | decision right / superseded | Scoped assertion retained, but the competence quote inserts “the” and both Handbook excerpt extents were unspecified. | Original eCFR §285.9(a), Handbook `competence` and `accreditation_decision` passages remain byte-identical / direct | Original automated provenance, uncertainty and Sara Kim’s approval content preserved; explicit retirement metadata. | Target of the NVLAP v2 supersession link. | Evidence representation corrected through a successor; historical wording is not source-exact. |
| `nist_nvlap_lab_decision_right_v2` | decision right / approved | Same scoped assertion; the human disposition confirms that the three selected passages continue to support it. | eCFR §285.9(a); Handbook `competence_clause_1_3_5` (all three sentences), `accreditation_decision_clause_3_5_3_sentence_1` (sentence 1) / direct | Same scope and uncertainty; implementation of explicit human disposition; accepted maintainer judgment. | Source of the NVLAP v2 supersession link. | Corrected quotation and explicit extents; source/version unchanged. |
| `nist_ai_standards_group_identity` | identity / approved | The passage names the group carrying out division efforts. | `nist.ai_research_measurement_standards_division` / `nist.ai_division.groups` / direct | Explicitly excludes legal personality, mandate, independent rights and capacity. Automated proposal; accepted human judgment. | — | Clear. |
| `nist_ai_standards_group_placement` | placement / superseded | Two passages establish the division's ITL placement and say its efforts are carried out by the group, but the preserved evidence incorrectly labels the composed placement direct. | `nist.ai_research_measurement_standards_division` / `nist.ai_division.itl_placement`, `nist.ai_division.groups` / both marked direct | Excludes mandate, rights and capacity. Automated proposal; its earlier approval judgment is superseded. | Target of `nist_ai_standards_group_placement_v2_supersedes_nist_ai_standards_group_placement`. | Defensible placement with an incorrect basis, now inactive and retained as history. |
| `nist_ai_standards_group_placement_v2` | placement / approved | Retains the placement while making its composition from the two selected passages explicit. | `nist.ai_research_measurement_standards_division` / `nist.ai_division.itl_placement`, `nist.ai_division.groups` / inferred | Preserves the same uncertainty boundaries. Human-review implementation; accepted human judgment. | Source of `nist_ai_standards_group_placement_v2_supersedes_nist_ai_standards_group_placement`. | Clear. |
| `nist_lab_network_capacity` | operational capacity / superseded | Six labs and user facilities support a laboratory-network capacity, but the preserved assertion's word “principal” does not appear in or follow from the passage. | `nist.laboratories` / `nist.laboratories.six_labs` / direct | Excludes equal status, staffing, funding, use, performance and condition. Automated proposal; its earlier approval judgment is superseded. | Target of `nist_lab_network_capacity_v2_supersedes_nist_lab_network_capacity`. | Unsupported modifier; correctly inactive and retained as history. |
| `nist_lab_network_capacity_v2` | operational capacity / approved | Six labs and user facilities directly support the laboratory-network capacity. The assertion is unchanged except for removal of “principal.” | `nist.laboratories` / `nist.laboratories.six_labs` / direct | Preserves the same uncertainty boundaries. Human-review implementation; accepted human judgment. | Source of `nist_lab_network_capacity_v2_supersedes_nist_lab_network_capacity`. | Clear. |
| `nist_aml_facility_capacity` | operational capacity / superseded | The passage directly inventories facility features and measurement infrastructure, but the preserved assertion uses the unnecessary stronger wording “NIST maintains.” | `nist.advanced_measurement_laboratory` / `nist.aml.features` / direct | Explicitly excludes current utilization, uptime, maintenance and full availability. Automated proposal; its earlier approval judgment is superseded. | Target of `nist_aml_facility_capacity_v2_supersedes_nist_aml_facility_capacity`. | Stronger wording now inactive and retained as history. |
| `nist_aml_facility_capacity_v2` | operational capacity / approved | States only the directly documented physical controls, laboratories and wings while retaining the facility-capacity classification. | `nist.advanced_measurement_laboratory` / `nist.aml.features` / direct | Preserves the same uncertainty boundaries. Human-review implementation; accepted human judgment. | Source of `nist_aml_facility_capacity_v2_supersedes_nist_aml_facility_capacity`. | Clear. |
| `nist_nvlap_accred_capacity` | operational capacity / approved | The regulation and program page directly describe an operating accreditation process and its components. The separate decision-right record prevents the process from silently implying broader authority. | `ecfr.title15_cfr_part_285` / `section_285_9_d`; `nist.accreditation` / `nist.accreditation.process` / direct | Excludes product certification, guaranteed results and NIST certification. Automated proposal; accepted human judgment. | — | Clear. |
| `nist_ai_measurement_capacity` | operational capacity / superseded | The passages establish a named division, its stated work and two named groups, but do not establish operational capacity. | `nist.ai_research_measurement_standards_division` / `nist.ai_division.capacity`, `nist.ai_division.groups` / direct | Explicitly excludes machinery, guidance, staffing, compute, throughput, model access and conclusive authority. Automated proposal; its earlier approval judgment is superseded. | Target of `nist_ai_measurement_function_supersedes_nist_ai_measurement_capacity`. | Too-strong classification, now inactive and retained as history. |
| `nist_ai_measurement_function` | function / approved | Records only the Division’s directly stated work in AI measurement science, testing/evaluation and standards. It does not combine that function with the separate named-groups fact. | `nist.ai_research_measurement_standards_division` / `nist.ai_division.capacity` / direct | Preserves the machinery, resources, throughput, availability and authority boundaries. Human-review implementation; accepted human judgment. | Source of `nist_ai_measurement_function_supersedes_nist_ai_measurement_capacity`. | Clear. |
| `nist_ai_consortium_capacity` | operational capacity / approved | The passages directly establish a research partnership, eligible external contributions and more than 280 participating organizations. The record correctly treats external resources as network access, not NIST-owned resources. | `nist.ai_consortium` / `partnership`, `contributions`, `organization_count` / direct | Explicitly preserves external ownership and excludes endorsement. Automated proposal; accepted human judgment. | — | Clear. |

## Exact selected passage ledger

Repeated use of one passage must preserve the same source, document version, locator, quotation,
passage hash and document hash. The current NIST corpus does so. The old Handbook passage IDs
below remain historical representations, including the defective competence wording. New IDs
carry the human-approved corrected extents without changing those historical signatures.

| Passage ID | Exact selected passage |
| --- | --- |
| `nist.about.identity` | The National Institute of Standards and Technology (NIST) was founded in 1901 and is now part of the U.S. Department of Commerce. |
| `nist.about.mission` | To promote U.S. innovation and industrial competitiveness by advancing measurement science, standards, and technology in ways that enhance economic security and improve our quality of life. |
| `nist.ai_standards_group.standards` | In addition to developing its own publications, the Group leads NIST's participation in the development of voluntary consensus standards, including international standards, that promote innovation and trustworthiness in systems and organizations that use AI. |
| `nist.ai_standards_group.guidance` | The Artificial Intelligence (AI) Standards and Guidelines Group develops technical resources and guidelines that help organizations to develop, deploy, and use AI with confidence, enabling U.S. industry to position itself at the forefront of technology development and AI governance. |
| `us_code.title15_usc_272.b_2` | to develop, maintain, and retain custody of the national standards of measurement, and provide the means and methods for making measurements consistent with those standards; |
| `ecfr.title15_cfr_part_285.section_285_9_a` | The Chief of NVLAP is responsible for all NVLAP accreditation actions, including granting, denying, renewing, suspending, and revoking any NVLAP accreditation. |
| `nist.handbook_150.competence` | NVLAP accreditation is based on the evaluation of a laboratory’s management and technical competence for conducting specific tests or calibrations. Accreditation is granted only after thorough evaluation of an applicant has demonstrated that all NVLAP requirements have been fulfilled. |
| `nist.handbook_150.accreditation_decision` | Based on this evaluation, NVLAP makes the decision whether or not to accredit the laboratory. |
| `nist.handbook_150.competence_clause_1_3_5` | NVLAP accreditation is based on evaluation of a laboratory’s management and technical competence for conducting specific tests or calibrations. Accreditation is granted only after thorough evaluation of an applicant has demonstrated that all NVLAP requirements have been fulfilled. Fulfillment of requirements is acknowledged by the issuance of a Certificate of Accreditation and a Scope of Accreditation, which details the specific test methods, calibration parameters, or services for which a laboratory has been accredited. |
| `nist.handbook_150.accreditation_decision_clause_3_5_3_sentence_1` | Based on this evaluation, NVLAP makes the decision whether or not to accredit the laboratory. |
| `nist.ai_division.itl_placement` | The AI Research, Measurement, and Standards Division is one of six technical divisions in the Information Technology Laboratory (ITL). The Division leads and coordinates the ITL AI Program. |
| `nist.ai_division.groups` | The AI Research, Measurement, and Standards Division’s efforts are carried out by the AI Standards and Guidelines Group and the Applied AI Research Group. |
| `nist.laboratories.six_labs` | Researchers at NIST—including five Nobel Prize winners—have been at the forefront of science in the nation’s premier measurement institute for more than 120 years. Their groundbreaking research happens in six labs (listed below) and user facilities. |
| `nist.aml.features` | The CNST is located within the NIST Advanced Measurement Laboratory Complex, one of the largest and most technologically advanced research facilities in the world. The complex offers laboratories with electromagnetic shielding, vibration isolation, and superior environmental control of temperature, humidity, and air quality. These laboratories allow NIST to provide the sophisticated measurements and standards needed by U.S. industry and the scientific community for key 21st century technologies such as nanotechnology, semiconductors, biotechnology, advanced materials, quantum computing, and advanced manufacturing. The $235 million, 49,843 square meter (536,507 square foot) Advanced Measurement Laboratory (AML) Complex features five separate wings, each with one scientific instrumentation level. Two metrology wings (buildings 218 and 219) are located underground, two physical sciences wings (buildings 216/CNST and 217) and a cleanroom wing (building 215/NanoFab) are located above ground. |
| `ecfr.title15_cfr_part_285.section_285_9_d` | When accreditation is granted, NVLAP shall provide to the laboratory a Certificate of Accreditation and a Scope of Accreditation, |
| `nist.accreditation.process` | Accreditation requirements are established in accordance with the U.S. Code of Federal Regulations (CFR, Title 15, Part 285), National Voluntary Laboratory Accreditation Program, and encompass the requirements of ISO/IEC 17025. Accreditation is granted following successful completion of a process which includes submission of an application and payment of fees by the laboratory, an on-site assessment, resolution of any nonconformities identified during the on-site assessment, participation in proficiency testing, and technical evaluation. The accreditation is formalized through issuance of a Certificate of Accreditation and Scope of Accreditation and publicized by announcement in various government and private media. |
| `nist.ai_division.capacity` | The AI Research, Measurement, and Standards Division strengthens trust in AI, accelerates its adoption, and expands U.S. AI preeminence by advancing the vital measurement science related to AI, testing and evaluation, and standards. The Division’s efforts reflect the most recent developments in AI as well as anticipated technological and commercialization progress. |
| `nist.ai_consortium.partnership` | Building upon its long track record of working with the private and public sectors to develop reliable and practical measurement and standards-oriented solutions, NIST has partnered with organizations from industry, academia, and civil society to form a research partnership that supports the development of science-based empirically-backed guidelines and standards for AI measurement that lays the foundation for global AI metrology. |
| `nist.ai_consortium.contributions` | Participation in the consortium is open to all interested organizations that can contribute their expertise, products, data, and/or models to the activities of the consortium. |
| `nist.ai_consortium.organization_count` | The Consortium brings together more than 280 organizations to develop science-based and empirically backed guidelines and standards for AI measurement. |

## Evidence after raw HTML retirement

Ten source registrations are used by NIST records. Each used source has a stable source ID, URL,
media type, retrieval time, source title, source version/date, explicit document-version identity
and document hash in `sources.writ`.
Every record repeats a document-version ID, locator, exact quote, passage hash, document hash and
basis. The eCFR XML and Handbook PDF are retained and hash-verifiable. The other eight used source
documents are intentionally represented by structured metadata and selected passages only.

This is sufficient to understand and review every current fact. The pre-hardening audit identified
two mechanical limitations:

1. The generic verifier reconstructs source and passage objects from record evidence; it does not
   load the manifest-routed Writ source declarations. A nonexistent source ID can therefore look
   resolvable merely because a record repeats it.
2. Whole-document hashes for retired HTML cannot be recomputed offline. This is the intended
   consequence of not being a web archive, not a missing record fact. Their selected passage hashes
   remain independently reproducible.

The implemented structured remedy makes source declarations first-class inputs to generic
verification and require every record evidence source to match the declaration's document hash.
Passage IDs should also be unique per corpus and byte-consistent wherever repeated. No raw web
capture is needed. The hardening implementation following this audit applies those mechanical
checks. Native source identity is exact and cannot be rescued by a matching hash. Retained
compatibility material resolves only through identities explicitly declared in its compatibility
metadata.

Document-version identities are opaque exact identifiers. Existing date-bearing NIST identifiers
remain because the records already use them as explicit retrieval-snapshot identities, not because
the verifier imposes a date format. The currently unused consortium-expansion source uses its
content hash as its explicit version identity.

## Contract boundary and adversarial model

The institutional schema's `oneOf` contract prevents a record from carrying more than one
fact-specific payload. Controlled enums reject unknown fact types, institution types, functions,
capacity statuses/types and relationship types. Capacity quantity rules, judgment supersession
rules, migrated-ID rules, endpoint resolution and endpoint-kind matching are authoritative and may
fail mechanically.

The schema cannot decide whether prose with a syntactically valid mandate payload is really mission
text, or whether function prose proves capacity. Nor can it decide whether certainty is warranted,
whether two accepted judgments substantively conflict, or whether an approved record was edited
instead of superseded. Those are human-review and Git-review boundaries unless a narrower
authoritative rule is adopted. Tests must expose these limits rather than pretending that schema
validation performs semantic reading.

## DSL assessment

The DSL currently earns a limited role:

- Its grammar makes record family, fact type, assertion mode, evidence basis, uncertainty type,
  review state and judgment status explicit, and its typed lowering deterministically selects the
  fact-specific JSON shape.
- Atomic payload exclusivity and controlled values are primarily JSON Schema capabilities; YAML or
  JSON validated against the same contracts could provide them.
- Exact declaration spans, canonical formatting and concise evidence syntax are genuinely
  language-level conveniences.
- Cross-file source, passage, link, judgment and migration resolution is not a language-level
  capability today. The verifier and corpus conventions provide it, incompletely.
- The DSL adds a parser, formatter, generated AST and lowering layer, while source declarations do
  not compile into a portable source contract. This weakens the claim that it is more inspectable
  than ordinary schema-validated data.

Replacing the DSL is not warranted by this audit. Later simplification should be considered if the
language does not gain stronger typed reference checking or if its concise authoring and exact
source slicing cease to offset the extra implementation surface.

## Generic-kernel audit

No NIST, United States, Commerce, current NIST record ID, source name or organizational assumption
appears in compiler, domain-schema, data-bundle or verifier production code. NIST-specific strings
are confined to corpus content and tests. That is not production leakage, but generic behavior is
sometimes proved only through NIST fixtures. Synthetic institutional fixtures should cover
compilation, source resolution, reference ambiguity, portable serialization and deterministic
verification without naming NIST or another real institution.

The compiler is pure over provided text. The verifier and bundle read only the selected workspace;
they perform no network access. The data bundle uses corpus-qualified stable keys, exact source
slices, explicit contract versions, canonical hashes and rejects absolute machine paths. Repeated
generation is byte-identical for a fixed commit identity. With exact source and document-version
identity checks now in place, these are adequate interoperability properties for the current
boundary.

## Problems and smallest corrections

### Corpus/content

- The explicit 2026-09-04 human disposition is implemented through
  `nist_nvlap_lab_decision_right_v2`. It retains the assertion with exact, explicitly bounded
  Handbook evidence and unchanged source/version identity. The original record, passage identities
  and approval remain superseded history; extraction evidence and the disposition are retained
  together under `docs/migrations/nist-handbook-competence/`.
- The approved human decision has been implemented through `nist_lab_network_capacity_v2`. The
  original record and judgment remain superseded history, and the Core link records the replacement
  direction without a record-level supersession field.
- The three remaining semantic decisions are implemented through reviewed successors. Placement
  now exposes its inferred two-passage basis, the AML assertion states only documented physical
  infrastructure, and the AI measurement successor is an atomic function rather than capacity.
- The separate `nist.ai_division.groups` passage remains preserved in the source ledger, historical
  capacity record, and existing group knowledge; it is not duplicated in the atomic function.
- Keep `nist_measurement_science_function` unchanged as superseded evidence of the corrected error.

### Schema/language

- Add boundary tests proving that payload exclusivity fails mechanically.
- Add explicit tests demonstrating that semantic mislabeling remains valid syntax and therefore
  requires human review.
- Do not add ontology or replace the DSL in this task.

### Verifier

- Structured Writ source declarations are now loaded generically instead of reconstructing source
  existence from record evidence.
- Missing sources and passages, wrong source IDs with otherwise-valid hashes, document-version
  mismatch, quotation-hash mismatch, repeated passage-ID conflicts, document-hash mismatch,
  ambiguous references, broken supersession, stale migrated IDs and endpoint-kind mismatch now
  have adversarial coverage.
- Synthetic fixtures prove kernel neutrality, atomic payload enforcement, portable output and
  deterministic compilation.

### Provenance

- Preserve one accepted judgment per current NIST object and verify every judgment target and
  evidence reference exactly.
- Treat unsupported certainty, substantively conflicting judgments and accepted-record mutation as
  human/Git review boundaries. Existing snapshots can detect unexpected byte drift but cannot
  authorize a mutation.

### Cosmetic or repository organization

- `nist.ai_consortium_expansion` is a registered but currently unused source. It is not a broken
  reference and needs no semantic change.
- Raw HTML absence is intentional. Do not restore it or add an archive directory.
