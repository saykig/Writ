"""Preservation and identity gates for the independent EU and US corpora."""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from pathlib import Path
from typing import Any

import yaml
from writ_ingest.corpus.eu_us_ai_governance import (
    CLAIM_REFS,
    CORPUS_RELATIVE_DIRS,
    EXPECTED_REVIEWED_SHA256,
    FORBIDDEN_ACTIVE_KEYS,
    IDENTITY_DERIVATION,
    IDENTITY_FIELDS,
    IDENTITY_NAMESPACE,
    REMOVED_NORMALIZED_FIELDS,
    REVIEWED_RELATIVE_PATH,
    build_corpus_documents,
    build_evidence_diagnostic_projection,
    load_reviewed_input,
    normalize_reviewed_claims,
    validate_active_corpora,
    write_corpus_documents,
)

ROOT = Path(__file__).resolve().parents[4]


def load_yaml(relative_path: Path) -> dict[str, Any]:
    value = yaml.safe_load((ROOT / relative_path).read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def active(jurisdiction: str, relative_path: str) -> dict[str, Any]:
    return load_yaml(CORPUS_RELATIVE_DIRS[jurisdiction] / relative_path)


def walk(value: Any):
    yield value
    if isinstance(value, dict):
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def identity_key(record_kind: str, immutable_import_key: str) -> str:
    return f"eu-us-ai-governance-v1:{record_kind}:{immutable_import_key}"


def test_reviewed_input_is_the_hash_pinned_authority() -> None:
    path = ROOT / REVIEWED_RELATIVE_PATH
    assert hashlib.sha256(path.read_bytes()).hexdigest() == EXPECTED_REVIEWED_SHA256
    assert EXPECTED_REVIEWED_SHA256 == (
        "8de1e3b84a15875a39f3de2857f68dcd3040830ad72ffd9728c1ded0eda07cbb"
    )


def test_exact_parent_and_atomic_claim_counts_are_preserved() -> None:
    summary = validate_active_corpora(root=ROOT)
    assert summary == {
        "eu_parent_reviews": 12,
        "us_parent_reviews": 12,
        "eu_claims": 15,
        "us_claims": 17,
        "legacy_mappings": 38,
        "passages": 22,
        "verified_sources": 10,
        "unknown_values": 12,
    }


def test_checked_in_corpora_match_a_fresh_deterministic_migration() -> None:
    write_corpus_documents(root=ROOT, check=True)
    assert set(build_corpus_documents(root=ROOT)) == {
        CORPUS_RELATIVE_DIRS[jurisdiction] / relative
        for jurisdiction in ("EU", "US")
        for relative in (
            "corpus.yaml",
            "sources/sources.yaml",
            "passages/passages.yaml",
            "passages/unresolved.yaml",
            "records/entities.yaml",
            "records/claims.yaml",
            "records/relationships.yaml",
            "reviews/parent-annotations.yaml",
            "reviews/reconciliation.yaml",
            "migration-map.yaml",
        )
    }


def test_every_reviewed_claim_field_survives_except_retired_pilot_fields() -> None:
    reviewed_claims = normalize_reviewed_claims(load_reviewed_input(root=ROOT))
    active_claims = [
        claim
        for jurisdiction in ("EU", "US")
        for claim in active(jurisdiction, "records/claims.yaml")["claims"]
    ]
    by_legacy = {
        claim["legacy_refs"][0]: claim
        for claim in active_claims
    }
    assert set(by_legacy) == set(CLAIM_REFS)

    active_metadata = {
        *IDENTITY_FIELDS,
        "record_type",
        "record_family",
        "review_status",
        "imported_review_machine_id",
        "family",
        "topics",
    }
    for reviewed in reviewed_claims:
        legacy_ref = reviewed["claim_id"]
        expected = {
            key: value
            for key, value in reviewed.items()
            if key not in REMOVED_NORMALIZED_FIELDS
        }
        actual = {
            key: value
            for key, value in by_legacy[legacy_ref].items()
            if key not in active_metadata
        }
        assert actual == expected, legacy_ref


def test_us_claims_map_to_legal_policy_and_controlled_ai_topic_only() -> None:
    us_claims = active("US", "records/claims.yaml")["claims"]
    assert len(us_claims) == 17
    assert all(claim["family"] == "legal_policy" for claim in us_claims)
    assert all(claim["topics"] == ["artificial_intelligence"] for claim in us_claims)

    eu_claims = active("EU", "records/claims.yaml")["claims"]
    assert all("family" not in claim and "topics" not in claim for claim in eu_claims)


def test_review_decisions_and_parent_groupings_are_preserved() -> None:
    reviewed = load_reviewed_input(root=ROOT)
    source_parents = {record["row_id"]: record for record in reviewed["records"]}
    migrated_reviews = [
        review
        for jurisdiction in ("EU", "US")
        for review in active(jurisdiction, "reviews/parent-annotations.yaml")["reviews"]
    ]
    assert len(migrated_reviews) == 24
    for review in migrated_reviews:
        parent = source_parents[review["imported_parent_legacy_ref"]]
        assert review["review_decision"] == parent["review_decision"] == "accepted"
        assert review["instrument"] == parent["instrument"]
        assert review["source_locator"] == parent["source_locator"]
        assert review.get("interpretation_note") == parent.get("interpretation_note")
        expected_children = (
            len(parent["derived_claims"])
            if parent["record_type"] == "source_bundle"
            else 1
        )
        assert len(review["claim_machine_ids"]) == expected_children


def test_corpus_migration_resolves_all_38_old_row_or_claim_ids_exactly_once() -> None:
    reviewed = load_reviewed_input(root=ROOT)
    expected: list[str] = []
    for parent in reviewed["records"]:
        expected.append(parent["row_id"])
        expected.extend(child["claim_id"] for child in parent.get("derived_claims", []))

    mappings = [
        entry
        for jurisdiction in ("EU", "US")
        for entry in active(jurisdiction, "migration-map.yaml")["entries"]
    ]
    mapped = [entry["legacy_ref"] for entry in mappings]
    assert len(mapped) == len(set(mapped)) == 38
    assert set(mapped) == set(expected)

    target_legacy_refs = [
        legacy_ref
        for jurisdiction in ("EU", "US")
        for relative, key in (
            ("records/claims.yaml", "claims"),
            ("reviews/parent-annotations.yaml", "reviews"),
        )
        for record in active(jurisdiction, relative)[key]
        for legacy_ref in record["legacy_refs"]
    ]
    assert sorted(target_legacy_refs) == sorted(mapped)


def test_active_refs_are_policy_readable_and_never_spreadsheet_ordered() -> None:
    legacy_pattern = re.compile(r"(?:eu|us)-\d{2}", re.IGNORECASE)
    for jurisdiction in ("EU", "US"):
        for relative, key in (
            ("sources/sources.yaml", "sources"),
            ("passages/passages.yaml", "passages"),
            ("records/entities.yaml", "entities"),
            ("records/claims.yaml", "claims"),
            ("records/relationships.yaml", "relationships"),
            ("reviews/parent-annotations.yaml", "reviews"),
        ):
            for record in active(jurisdiction, relative)[key]:
                assert all(field in record for field in IDENTITY_FIELDS)
                assert legacy_pattern.search(record["ref"]) is None
                assert record["ref"] == record["ref"].lower()
                assert " " not in record["ref"]


def test_machine_ids_are_reproducible_uuidv5_values() -> None:
    assert IDENTITY_DERIVATION.startswith("UUIDv5")
    for jurisdiction in ("EU", "US"):
        for claim in active(jurisdiction, "records/claims.yaml")["claims"]:
            legacy_ref = claim["legacy_refs"][0]
            assert claim["machine_id"] == str(
                uuid.uuid5(IDENTITY_NAMESPACE, identity_key("claim", legacy_ref))
            )


def test_relationships_depend_only_on_machine_ids() -> None:
    for jurisdiction in ("EU", "US"):
        relationships = active(jurisdiction, "records/relationships.yaml")[
            "relationships"
        ]
        for relationship in relationships:
            assert relationship["subject_machine_id"]
            assert relationship["object_machine_id"]
            assert "subject_ref" not in relationship
            assert "object_ref" not in relationship


def test_active_corpus_documents_have_no_comparative_or_headline_fields() -> None:
    for relative_dir in CORPUS_RELATIVE_DIRS.values():
        for path in (ROOT / relative_dir).rglob("*.yaml"):
            document = yaml.safe_load(path.read_text())
            for node in walk(document):
                if isinstance(node, dict):
                    assert FORBIDDEN_ACTIVE_KEYS.isdisjoint(node)


def test_source_passages_and_hashes_are_traceable_without_loss() -> None:
    archived_sources = json.loads(
        (
            ROOT
            / "archive/pilots/eu-us-ai-evaluation-v1/original/provenance/document-versions.json"
        ).read_text(encoding="utf-8")
    )
    archived_passages = json.loads(
        (
            ROOT
            / "archive/pilots/eu-us-ai-evaluation-v1/original/provenance/passages.json"
        ).read_text(encoding="utf-8")
    )
    active_sources = [
        source
        for jurisdiction in ("EU", "US")
        for source in active(jurisdiction, "sources/sources.yaml")["sources"]
        if source["verification_status"] == "verified"
    ]
    active_passages = [
        passage
        for jurisdiction in ("EU", "US")
        for passage in active(jurisdiction, "passages/passages.yaml")["passages"]
    ]
    source_by_legacy = {source["legacy_refs"][0]: source for source in active_sources}
    passage_by_legacy = {
        passage["legacy_refs"][0]: passage for passage in active_passages
    }

    assert len(source_by_legacy) == len(archived_sources) == 10
    assert len(passage_by_legacy) == len(archived_passages) == 22
    for source in archived_sources:
        migrated = source_by_legacy[source["id"]]
        for field in source.keys() - {"id"}:
            assert migrated[field] == source[field]
    for passage in archived_passages:
        migrated = passage_by_legacy[passage["id"]]
        for field in passage.keys() - {"id", "row_id", "document_version_id"}:
            assert migrated[field] == passage[field]


def test_evidence_crosswalk_has_exact_object_specific_coverage() -> None:
    results = build_evidence_diagnostic_projection(root=ROOT)

    identity_expectations = (
        ("snapshot_claim_identity", "CLAIM_IDENTITY_EXACT", 27),
        ("snapshot_passage_identity", "PASSAGE_IDENTITY_EXACT", 22),
        (
            "snapshot_document_version_identity",
            "DOCUMENT_SOURCE_IDENTITY_EXACT",
            10,
        ),
        ("snapshot_review_identity", "REVIEWED_OBJECT_IDENTITY_EXACT", 27),
    )
    for concept, reason, expected_count in identity_expectations:
        mappings = [
            result
            for result in results
            if result["source_concept"] == concept
            and result["mapping_status"] == "mapped"
            and result["reason_code"] == reason
        ]
        target_identities: list[tuple[str, str, str]] = []
        for mapping in mappings:
            target = mapping["target_identity"]
            assert target is not None
            target_identities.append(
                (target["jurisdiction"], target["object_kind"], target["id"])
            )
        assert len(target_identities) == expected_count
        assert len(set(target_identities)) == expected_count

    reviewed_objects = [
        result
        for result in results
        if result["source_concept"] == "snapshot_review_identity"
    ]
    assert all(
        result["target_identity"] is not None
        and result["target_identity"]["object_kind"] == "snapshot_claim"
        for result in reviewed_objects
    )
    assert all(
        result["target_identity"] is None
        or result["target_identity"]["object_kind"] != "active_review"
        for result in reviewed_objects
    )


def test_five_accepted_claims_have_separate_unresolved_evidence_identities() -> None:
    results = build_evidence_diagnostic_projection(root=ROOT)
    unresolved = [
        result
        for result in results
        if result["reason_code"] == "EVIDENCE_IDENTITY_NOT_AVAILABLE"
    ]
    assert [result["source_identity"]["id"] for result in unresolved] == [
        "EU-10A",
        "EU-10B",
        "EU-10C",
        "EU-12",
        "US-02",
    ]
    assert all(result["mapping_status"] == "unresolved" for result in unresolved)
    assert [result["source_pointer"].rsplit("/", 1)[-1] for result in unresolved] == [
        "0",
        "0",
        "0",
        "1",
        "2",
    ]
    assert [result for result in results if result["mapping_status"] != "mapped"] == unresolved

    parent_decisions = {
        result["source_identity"]["id"]: result
        for result in results
        if result["source_concept"] == "reviewed_parent_decision"
    }
    active_claims = {
        claim["legacy_refs"][0]: claim
        for jurisdiction in ("EU", "US")
        for claim in active(jurisdiction, "records/claims.yaml")["claims"]
    }
    expected_unresolved_claim_ids = {
        "EU-10A",
        "EU-10B",
        "EU-10C",
        "EU-12",
        "US-02",
    }
    parent_decision_claim_ids = parent_decisions.keys() & expected_unresolved_claim_ids
    assert parent_decision_claim_ids == expected_unresolved_claim_ids
    for claim_id in sorted(parent_decision_claim_ids):
        assert parent_decisions[claim_id]["mapped_values"] == {
            "reviewed_parent_decision": "accepted"
        }
        assert active_claims[claim_id]["review_status"] == "accepted"


def test_crosswalk_semantics_are_deterministic_and_independent_of_identity() -> None:
    first = build_evidence_diagnostic_projection(root=ROOT)
    second = build_evidence_diagnostic_projection(root=ROOT)
    assert first == second
    assert json.dumps(first, sort_keys=True, separators=(",", ":")) == json.dumps(
        second, sort_keys=True, separators=(",", ":")
    )

    semantic_results = [
        result
        for result in first
        if result["source_concept"]
        in {
            "stance",
            "support_type",
            "truth_value",
            "workflow_status",
            "reviewed_parent_decision",
            "snapshot_review_decision",
        }
    ]
    assert semantic_results
    assert all(result["mapping_status"] == "mapped" for result in semantic_results)
    assert all(result["target_identity"] is None for result in semantic_results)
    assert {
        result["mapped_values"]["snapshot_review_decision"]
        for result in semantic_results
        if result["source_concept"] == "snapshot_review_decision"
    } == {"accept"}
    assert {
        result["mapped_values"]["reviewed_parent_decision"]
        for result in semantic_results
        if result["source_concept"] == "reviewed_parent_decision"
    } == {"accepted"}


def test_unknowns_and_legal_distinctions_remain_explicit() -> None:
    claims = [
        claim
        for jurisdiction in ("EU", "US")
        for claim in active(jurisdiction, "records/claims.yaml")["claims"]
    ]
    assert {claim["legacy_refs"][0] for claim in claims if claim["enforcement_status"] == "unknown"} == {
        "EU-01",
        "EU-02",
        "EU-03",
        "EU-04",
        "EU-05",
        "EU-06",
        "EU-07",
        "EU-08",
        "EU-09",
        "EU-10B",
        "EU-11A",
        "EU-11B",
    }
    for claim in claims:
        assert "legal_force" in claim
        assert "adoption_status" in claim
        assert "applicability_status" in claim
        assert "enforcement_status" in claim
        assert "lifecycle_status" not in claim
        if claim.get("compliance_function") == "recognized_compliance_path":
            assert claim["legal_force"] == "voluntary"


def test_corrected_article_55_mapping_and_exclusions_survive() -> None:
    eu_map = active("EU", "migration-map.yaml")
    corrected = {
        entry["source_locator"]: entry["corrected_row_id"]
        for entry in eu_map["corrected_numbering"]
    }
    assert corrected == {
        "Article 55(1)(a)": "EU-06",
        "Article 55(1)(b)": "EU-07",
        "Article 55(1)(c)": "EU-08",
        "Article 55(1)(d)": "EU-09",
    }
    assert {
        entry["source_locator"] for entry in eu_map["excluded_temporary_assignments"]
    } == {"Article 51(1)-(2)", "Article 52(1)"}
    eu_claim_locators = {
        claim["source_locator"]
        for claim in active("EU", "records/claims.yaml")["claims"]
    }
    assert eu_claim_locators.isdisjoint({"Article 51(1)-(2)", "Article 52(1)"})


def test_each_jurisdiction_can_be_queried_without_a_methodology_or_score() -> None:
    eu_claims = active("EU", "records/claims.yaml")["claims"]
    us_claims = active("US", "records/claims.yaml")["claims"]
    assert [
        claim["ref"]
        for claim in eu_claims
        if claim.get("conduct_type") == "model_evaluation"
    ] == ["eu/ai-governance/ai-act/art-55-1-a#model-evaluation"]
    assert len(
        [
            claim
            for claim in us_claims
            if claim.get("binding_scope") == "federal_agencies_only"
        ]
    ) == 5
    for corpus in (eu_claims, us_claims):
        assert all("score" not in claim for claim in corpus)
