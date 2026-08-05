# NIST institutional corpus

The six automated draft records have been human reviewed. Stage A implements that review
against the native atomic institutional v0.2 contract: each record now carries exactly one
directly supported institutional fact, and the placeholder mandate, function and
operational-capacity payloads that the v0.1 drafts used to fill unsupported categories have
been removed rather than retained as `unknown`.

## Final Stage A objects

Five approved institutional records:

| Record                                   | Fact type |
| ---------------------------------------- | --------- |
| `nist_identity`                          | identity  |
| `nist_organizational_placement`          | placement |
| `nist_mission`                           | mission   |
| `nist_ai_standards_development_function` | function  |
| `nist_ai_technical_guidance_function`    | function  |

One superseded historical record, `nist_measurement_science_function`. Its passage is
explicitly labelled a mission statement, so the mission record replaced it. The record is
retained as review history, not deleted.

Two Core record links are stored separately under `relationships/`, not as institutional
records: `nist_department_of_commerce_relationship` (`part_of`, citing
`nist_organizational_placement` as its supporting record) and
`nist_mission_supersedes_nist_measurement_science_function` (`supersedes`). Inverse traversal
is derived; no inverse link is stored.

Eight accepted disposition judgments in `judgments.writ` carry the human review authority.
Judgment `status` is a separate vocabulary from record `review_state`: a judgment is
`accepted`, while a record or link is `approved` or `superseded`.

## What remains unpopulated

Mandate, decision rights, operational capacity, and the AI Standards and Guidelines Group's
identity and formal placement are not represented. Their absence means the reviewed Stage A
evidence does not establish them; it does not mean they are false. They await Stage B
research, which has not been done.

Corpus status remains `draft`. Record approval does not publish or activate the corpus.

## Sources

Only the two registered sources are used. Passages are quoted exactly and carry stable
passage and retrieved-document hashes. The About NIST page version is its stated January 11,
2022 update; the AI Standards and Guidelines Group page is versioned by its August 3, 2026
retrieval. Mission and function statements are not represented as statutory authority.

The five records carried over from the automated drafts keep their original
`OpenAI Codex automated draft` provenance. `nist_mission` and the supersession link are new
objects produced by the approved review and are attributed to its implementation, not to the
original drafting. The old-to-new mapping is recorded in `migration.yaml`.
