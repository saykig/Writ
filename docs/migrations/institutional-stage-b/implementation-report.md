# NIST and European Commission institutional Stage B implementation

This report is the implementation and pull-request record for the work that began from
`14ec512a28949155054dd2e7479337dbfce95f8c`, the then-current `origin/main` and merge commit for
PR #10. The PR #10 NIST Stage A corpus was present and matched its expected inventory before any
Stage B edit. The machine-readable pre-edit evidence is in
`pre-implementation-inventory.json`.

## Preservation results

NIST Stage A remains six records (five approved and one superseded), two approved Core links,
eight accepted disposition judgments and two protected source identities. Every protected record
ID, assertion, review state, provenance field, evidence locator, exact quotation, passage hash and
document hash matches the pre-implementation inventory. Both relationship files remain
byte-for-byte identical. The eight original judgments and the original `sources.writ` remain exact
byte prefixes; only the nine Stage B judgments and official Stage B sources were appended. The
first eight migration entries are unchanged. No Stage A record gained a mandate, decision-right or
capacity payload.

The three existing Commission AI Office function records retain their IDs, assertions, function
values, subjects, scope, conditions, evidence source and document-version IDs, locators,
quotations, passage and document hashes, and creation provenance. Their only record-level change
is `review_state: draft` to `review_state: approved`; each has one accepted first-disposition
judgment.

The shared AI Act source registry and passage registry were reused without modification. Their
file hashes remain `cff778809423fbaf6e428565a7bc56df1dca583c3de91c1fdce2a09c8cf2aa72` and
`a4493f8821a66184708fcb6003a8293693a2061d38763b7f0e8b779db4c2608f`, respectively.

## Newly registered official sources

| Corpus | Source ID | Document version | Official source |
| --- | --- | --- | --- |
| NIST | `us_code.title15_usc_272` | `us_code.title15_usc_272.v2024` | 15 U.S.C. § 272, 2024 edition |
| NIST | `ecfr.title15_cfr_part_285` | `ecfr.title15_cfr_part_285.v2026_08_01` | 15 CFR Part 285, effective 2026-08-01 |
| NIST | `nist.handbook_150` | `nist.handbook_150.v2020_update_1` | NIST Handbook 150:2020 Update 1 |
| NIST | `nist.accreditation` | `nist.accreditation.v2026_08_05` | NVLAP accreditation page |
| NIST | `nist.laboratories` | `nist.laboratories.v2026_08_05` | NIST Laboratories page |
| NIST | `nist.advanced_measurement_laboratory` | `nist.advanced_measurement_laboratory.v2026_08_05` | Advanced Measurement Laboratory page |
| NIST | `nist.ai_research_measurement_standards_division` | `nist.ai_research_measurement_standards_division.v2026_08_05` | AI Research, Measurement, and Standards Division page |
| NIST | `nist.ai_consortium` | `nist.ai_consortium.v2026_08_05` | NIST AI Consortium page |
| NIST | `nist.ai_consortium_expansion` | `nist.ai_consortium_expansion.v2026_05_29` | NIST consortium expansion announcement |
| Commission | `eu.teu_article_13` | `eu.teu_article_13.v2026_08_05` | TEU Article 13 |
| Commission | `eu.teu_article_17` | `eu.teu_article_17.v2026_08_05` | TEU Article 17 |
| Commission | `eu.tfeu_article_258` | `eu.tfeu_article_258.v2026_08_05` | TFEU Article 258 |
| Commission | `eu.commission_decision_c_2024_1459` | `eu.commission_decision_c_2024_1459.v2024_02_14` | Commission Decision C/2024/1459 |
| Commission | `eu.european_commission_institution` | `eu.european_commission_institution.v2026_08_05` | European Commission institution page |
| Commission | `ec.planning_proposing_law` | `ec.planning_proposing_law.v2026_08_05` | Planning and proposing law page |
| Commission | `ec.budget_funding` | `ec.budget_funding.v2026_08_05` | Budget and funding page |
| Commission | `ec.european_ai_office` | `ec.european_ai_office.v2026_08_05` | European AI Office page |
| Commission | `ec.jrc_research_infrastructures` | `ec.jrc_research_infrastructures.v2026_08_05` | JRC research infrastructures page |

Every capture has a complete-source SHA-256 in its corpus-local source manifest. Every production
record quotation has its own passage hash, and the focused test independently recomputes all
capture and quotation hashes.

## NIST Stage B records

| Record | Atomic fact | Outcome |
| --- | --- | --- |
| `nist_national_measurement_standards_mandate` | mandate | new, approved |
| `nist_nvlap_lab_decision_right` | decision right | new, approved |
| `nist_ai_standards_group_identity` | identity | new, approved |
| `nist_ai_standards_group_placement` | placement | new, approved |
| `nist_laboratory_network_capacity` | operational capacity / laboratory network | new, approved |
| `nist_aml_facility_capacity` | operational capacity / facility | new, approved |
| `nist_nvlap_accreditation_capacity` | operational capacity / accreditation system | new, approved |
| `nist_ai_measurement_capacity` | operational capacity / technical capability | new, approved |
| `nist_ai_consortium_capacity` | operational capacity / partnership network | new, approved |

## Final Commission record inventory

| Record | Atomic fact | Outcome |
| --- | --- | --- |
| `eu_ai_office_technical_documentation_receipt` | function | existing; promoted draft → approved |
| `eu_ai_office_training_summary_template_function` | function | existing; promoted draft → approved |
| `eu_ai_office_serious_incident_report_receipt` | function | existing; promoted draft → approved |
| `european_commission_identity` | identity | new, approved |
| `eu_ai_office_identity` | identity | new, approved |
| `eu_ai_office_placement` | placement | new, approved |
| `european_commission_mission` | mission | new, approved |
| `eu_ai_office_mission` | mission | new, approved |
| `european_commission_union_law_mandate` | mandate | new, approved |
| `eu_ai_office_gp_ai_enforcement_mandate` | mandate | new, approved |
| `european_commission_legislative_proposal_function` | function | new, approved |
| `european_commission_budget_management_function` | function | new, approved |
| `eu_ai_office_model_eval_function` | function | new, approved |
| `european_commission_reasoned_opinion_decision_right` | decision right | new, approved |
| `european_commission_cjeu_referral_decision_right` | decision right | new, approved |
| `european_commission_gp_ai_fine_decision_right` | decision right | new, approved |
| `eu_ai_office_model_eval_decision_right` | decision right | new, approved |
| `european_commission_jrc_infra_capacity` | operational capacity / laboratory network | new, approved |
| `eu_ai_office_org_capacity` | operational capacity / organizational unit | new, approved |
| `eu_ai_office_model_eval_capacity` | operational capacity / technical capability | new, approved |
| `eu_ai_office_cooperation_capacity` | operational capacity / partnership network | new, approved |

## Relationships, judgments and counts

The existing NIST `nist_department_of_commerce_relationship` remains an unchanged approved
`part_of` link. The new `eu_ai_office_euro_comiss_relationship` is an approved Core `part_of` link
from the AI Office to the Commission, supported by `eu_ai_office_placement`; no inverse duplicate
is stored. The other protected NIST Core link, the mission-to-function supersession link, also
remains byte-identical.

The nine NIST Stage B records each have one new accepted `review_disposition` judgment. The 21
Commission records and one Commission Core link each have one accepted first-disposition judgment.
All 31 new judgments reuse reviewer `Sara Kim`, are dated 2026-08-05, resolve to their exact target,
and state the distinction that limits the approved finding. No Stage A judgment is duplicated or
superseded.

Final NIST counts are 15 institutional records, 14 approved, one superseded, two approved links and
17 accepted judgments. Final Commission counts are 21 approved institutional records, one approved
link and 22 accepted judgments. Both corpora remain draft workflow corpora, and both migration
ledgers cover all additions.

## Contract and interoperability decision

`supranational_institution` is added as a controlled institutional type while `federal_agency` and
`organizational_unit` remain distinct. The finalized operational-capacity payload requires
`status`, `capacity_type` and `evidence_refs`; it optionally accepts unique
`capacity_components`, `as_of_date`, and a controlled `quantity` (`value`, `unit`, `qualifier`). A
quantity requires temporal context. The accepted status, type and qualifier vocabularies are closed.

ADR-0018 records the versioning decision. This is a pre-production completion of the native
institutional v0.2 contract, permitted by `VERSION_POLICY.md`: the preservation inventory and tests
prove that no native production operational-capacity record existed to invalidate. The frozen v0.1
schema and legacy grammar remain available. The authoritative schema, vendored schema, embedded
runtime copy, domain types, parser, compiler, formatter, grammar and EBNF were updated and generated
artifacts regenerated.

| Atomic schema | NIST production example | Commission production example |
| --- | --- | --- |
| identity | `nist_identity`; `nist_ai_standards_group_identity` | `european_commission_identity`; `eu_ai_office_identity` |
| placement | `nist_organizational_placement`; `nist_ai_standards_group_placement` | `eu_ai_office_placement` |
| relationship | NIST → Commerce `part_of` | AI Office → Commission `part_of` |
| mission | `nist_mission` | `european_commission_mission`; `eu_ai_office_mission` |
| mandate | `nist_national_measurement_standards_mandate` | `european_commission_union_law_mandate`; `eu_ai_office_gp_ai_enforcement_mandate` |
| function | NIST standards/guidance functions | Commission/AI Office legislative, budget, receipt and evaluation functions |
| decision right | `nist_nvlap_lab_decision_right` | Article 258, Article 101 and AI Office evaluation rights |
| operational capacity | laboratories, AML, NVLAP, AI division, consortium | JRC infrastructure and AI Office organization, evaluation and cooperation machinery |

The shared grammar does not flatten the institutions: federal, supranational and organizational-unit
types remain different; NIST laboratories and JRC infrastructure keep different components and
scope; the NIST consortium and AI Office cooperation capacity retain different ownership
boundaries; NVLAP requires no Commission analogue; and model-evaluation function, right and capacity
remain separate. Decision rights attach directly to `institution_id`; no holder hierarchy, Director
entity, ITL profile, AI-division profile or DG CONNECT profile was added.

No workforce, budget, compute, degraded-facility, generic-status or effectiveness record was added.
No accepted legal-policy record, G7/G20 archive, archived pilot or frontend behavior changed.

## Validation

The following checks pass on the completed implementation:

- `bun run format`, `bun run lint`, `bun run typecheck`, `bun run test`, `bun run conformance`, and
  `bun run build`;
- `validate_pack.py` and source-registry drift validation;
- Ruff, mypy, and 166 Python tests under `apps/ingest` and `internal/verification`;
- focused Stage A/Commission preservation, source and passage hashing, schema/vendored drift,
  generated language artifacts, judgment target/supersession, manifest/migration,
  interoperability and shared AI Act checks;
- corpus-local source checksum manifests and the final root tracked-tree checksum.

The prompt's plain Python commands were run with the repository's configured `.venv` executables
and `PYTHONPATH=apps/ingest/src`, because the ingest package uses a source layout. Bun commands used
the workspace's configured Bun/Node runtime paths.

## Source-access note

Direct command-line retrieval from `uscode.house.gov` timed out. The preserved section capture is
the official GovInfo 2024-edition section PDF, whose U.S. Code content is produced by the Office of
the Law Revision Counsel; the current OLRC text was separately checked for the cited subsection.
No quotation was reconstructed from the prompt. All other cited sources were captured directly
from the permitted official domains. Publisher-supplied Mapbox access tokens embedded in six NIST
HTML responses were replaced with the explicit marker `[REDACTED_PUBLISHER_MAPBOX_TOKEN]` before
storage; those transport credentials are not evidence, and every document hash covers the complete
stored, redacted representation. The file-by-file pre/post hashes and non-intersection proof are in
`source-sanitization-ledger.json`. There is no unresolved evidentiary issue in the implemented
records.
