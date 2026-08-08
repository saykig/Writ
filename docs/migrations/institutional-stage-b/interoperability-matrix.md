# Institutional Stage B interoperability assessment

Matrix ID: `institutional-stage-b-interoperability-v1`

Schema validation establishes **structural interoperability**: NIST and Commission records compile
to the same native institutional contract and use its controlled vocabularies. It does not by
itself establish semantic equivalence. **Semantic interoperability requires reviewed mappings**
from each exact passage to the selected fact type and payload. No complete Stage B human-approval
artifact exists, so the mappings below are automated proposals pending human review; full semantic
interoperability is not claimed.

The machine-readable assessment is in `interoperability-matrix.json`.

| Atomic schema | Shared definition | NIST example | Commission example | Authority types | Mapping and equivalence | Differences and uncertainty | Result / limitation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| identity | Named subject and institutional type only | `nist_ai_standards_group_identity` | `eu_ai_office_identity` | Official organization page; establishing decision | Equivalent as named organizational-unit existence; the institutions themselves are only analogous | Legal system, scale and personality remain distinct; no placement or power inferred | Schema passed unchanged |
| placement | Directly evidenced immediate parent | `nist_ai_standards_group_placement` | `eu_ai_office_placement` | Official organization page; establishing decision | Equivalent immediate-parent mapping | AI division and DG CONNECT are different institutional forms; full ancestry is not embedded in one record | Schema passed; complete chain requires linked records |
| relationship | Directed Core link with basis | NIST → Commerce `part_of` | AI Office → Commission `part_of` | Agency page; establishing decision plus placement | Equivalent traversal semantics | NIST link is direct; Commission-root link is inherited through DG CONNECT | Schema passed; Core link has no explicit chain field |
| mission | Source-reported purpose | `nist_mission` | `european_commission_mission` | Mission page; institution role page | Equivalent broad-purpose role | Commission source says “role,” not “mission”; classification remains uncertain | Schema passed; terminology requires review |
| mandate | Authority-assigned responsibility | `nist_national_measurement_standards_mandate` | `european_commission_union_law_mandate` | Stored 2024 U.S. Code edition; EU treaty | Equivalent responsibility mapping | Different legal systems; NIST capture proves only 2024-edition text | Schema passed; currency remains provenance-bound |
| function | Assigned institutional activity | `nist_ai_standards_development_function` | `eu_ai_office_model_eval_function` | Organization page; establishing decision | Equivalent activity-without-capacity distinction | Standards and regulatory contexts differ; performance is unknown | Schema passed unchanged |
| decision right | Conditional institutional discretion | `nist_nvlap_lab_decision_right` | `european_commission_cjeu_referral_decision_right` | Regulation/handbook; EU treaty | Equivalent scoped decision authority | Consequences and procedures differ; mandatory Article 258 reasoned-opinion delivery is excluded | Schema passed; modality needs review |
| operational capacity | Directly evidenced machinery with controlled type and evidence-bound components | `nist_nvlap_accreditation_capacity` | `european_commission_jrc_infra_capacity` | Regulation/program page; infrastructure page | Equivalent maintained-machinery concept | Workflow and laboratories are only analogous; components and quantities remain distinct | Schema passed; component-to-quotation support requires tests and review |

The comparison therefore supports one shared structural contract without flattening federal,
supranational and organizational-unit differences. Human approval of the queue in
`review-queue.yaml` is still required before claiming reviewed semantic interoperability.
