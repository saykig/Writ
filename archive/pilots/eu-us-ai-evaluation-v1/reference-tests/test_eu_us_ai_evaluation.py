"""Acceptance and mutation tests for the human-reviewed EU-US AI evaluation pilot.

The positive tests pin the reviewed shape. The mutation tests are the point of the
suite: each one performs a schema-valid edit that a careless normalizer or a hurried
reviewer might make, and asserts that validation refuses it.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest
from writ_ingest.pilot.eu_us_ai_evaluation import (
    ALLOWED_ENFORCEMENT_STATUS,
    CLAIMS_WITHOUT_ACTOR_TYPE,
    CONDUCT_FAMILY_EVALUATION_CONDUCT,
    ENFORCEMENT_PARTITION,
    EU_LOCATOR_TO_ROW,
    EXPECTED_ROW_IDS,
    LEGAL_FORCE_PARTITION,
    LIFECYCLE_FIELDS,
    MODEL_EVALUATION_CLAIM_IDS,
    NORMALIZED_RELATIVE_DIR,
    REMOVED_TEMPORARY_LOCATORS,
    PilotValidationError,
    derive_headline_judgments,
    load_reviewed_dataset,
    normalize_claims,
    satisfies_headline_rule,
    validate_pilot_graph,
    validate_reviewed_dataset,
)

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def dataset() -> dict[str, Any]:
    return load_reviewed_dataset()


@pytest.fixture(scope="module")
def claims(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    return normalize_claims(dataset)


def run_full_validation(document: dict[str, Any]) -> dict[str, Any]:
    """The complete gate, as the emit script runs it."""
    validate_reviewed_dataset(document)
    generated = normalize_claims(document)
    headlines = derive_headline_judgments(generated)
    validate_pilot_graph(document, generated, headlines)
    return headlines


def mutate(dataset: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(dataset)


def find_record(document: dict[str, Any], row_id: str) -> dict[str, Any]:
    for record in document["records"]:
        if record["row_id"] == row_id:
            return record
    raise AssertionError(f"no such row: {row_id}")


def find_claim(document: dict[str, Any], claim_id: str) -> dict[str, Any]:
    for record in document["records"]:
        for child in record.get("derived_claims", []):
            if child["claim_id"] == claim_id:
                return child
    raise AssertionError(f"no such derived claim: {claim_id}")


# --------------------------------------------------------------------------- positive


def test_reviewed_dataset_validates(dataset: dict[str, Any]) -> None:
    run_full_validation(mutate(dataset))


def test_parent_row_counts(dataset: dict[str, Any]) -> None:
    records = dataset["records"]
    assert len(records) == 24
    assert sum(1 for r in records if r["jurisdiction"] == "EU") == 12
    assert sum(1 for r in records if r["jurisdiction"] == "US") == 12


def test_normalized_claim_count(claims: list[dict[str, Any]]) -> None:
    assert len(claims) == 32
    assert sum(1 for c in claims if c["claim_origin"] == "parent_record") == 18
    assert sum(1 for c in claims if c["claim_origin"] == "derived_claim") == 14


def test_row_numbering_follows_the_uploaded_table(dataset: dict[str, Any]) -> None:
    assert tuple(r["row_id"] for r in dataset["records"]) == EXPECTED_ROW_IDS


def test_parent_row_ids_are_unique(dataset: dict[str, Any]) -> None:
    row_ids = [r["row_id"] for r in dataset["records"]]
    assert len(row_ids) == len(set(row_ids))


def test_claim_ids_are_unique(claims: list[dict[str, Any]]) -> None:
    claim_ids = [c["claim_id"] for c in claims]
    assert len(claim_ids) == len(set(claim_ids))


def test_every_claim_resolves_to_its_parent(
    dataset: dict[str, Any], claims: list[dict[str, Any]]
) -> None:
    row_ids = {r["row_id"] for r in dataset["records"]}
    for claim in claims:
        assert claim["parent_row_id"] in row_ids
        assert claim["claim_id"].startswith(claim["parent_row_id"])


@pytest.mark.parametrize(
    ("row_id", "child_count"),
    [("EU-10", 3), ("EU-11", 2), ("US-05", 2), ("US-08", 2), ("US-09", 3), ("US-10", 2)],
)
def test_source_bundles_keep_all_their_children(
    dataset: dict[str, Any], claims: list[dict[str, Any]], row_id: str, child_count: int
) -> None:
    assert len(find_record(dataset, row_id)["derived_claims"]) == child_count
    assert sum(1 for c in claims if c["parent_row_id"] == row_id) == child_count


def test_no_pending_or_rejected_reviews(dataset: dict[str, Any]) -> None:
    decisions = {r["review_decision"] for r in dataset["records"]}
    assert decisions == {"accepted"}


def test_lifecycle_dimensions_stay_separate(claims: list[dict[str, Any]]) -> None:
    for claim in claims:
        for field in LIFECYCLE_FIELDS:
            assert field in claim, f"{claim['claim_id']} lost {field}"
        assert "lifecycle_status" not in claim


def test_unknown_enforcement_status_is_preserved(claims: list[dict[str, Any]]) -> None:
    unknown = {c["claim_id"] for c in claims if c["enforcement_status"] == "unknown"}
    assert unknown == ENFORCEMENT_PARTITION["unknown"]
    assert len(unknown) == 12


def test_enforcement_partition_covers_every_claim(claims: list[dict[str, Any]]) -> None:
    assert sum(len(ids) for ids in ENFORCEMENT_PARTITION.values()) == len(claims)
    for status, expected in ENFORCEMENT_PARTITION.items():
        assert {c["claim_id"] for c in claims if c["enforcement_status"] == status} == expected


def test_legal_force_is_recorded_separately_from_compliance_function(
    claims: list[dict[str, Any]],
) -> None:
    forces = set(LEGAL_FORCE_PARTITION)
    functions = {
        c["compliance_function"] for c in claims if "compliance_function" in c
    }
    assert forces & functions == set(), "legal force and compliance function must not share terms"
    for claim in claims:
        if claim.get("compliance_function") == "recognized_compliance_path":
            assert claim["legal_force"] == "voluntary"


def test_model_evaluation_is_not_inferred(claims: list[dict[str, Any]]) -> None:
    evaluated = {c["claim_id"] for c in claims if c.get("conduct_type") == "model_evaluation"}
    assert evaluated == MODEL_EVALUATION_CLAIM_IDS


def test_conduct_family_evaluation_is_not_model_evaluation(claims: list[dict[str, Any]]) -> None:
    family = {c["claim_id"]: c.get("conduct_type") for c in claims if "conduct_family" in c}
    assert family == CONDUCT_FAMILY_EVALUATION_CONDUCT
    assert set(family) & MODEL_EVALUATION_CLAIM_IDS == set()


@pytest.mark.parametrize(
    "conduct_type",
    [
        "evaluation_documentation",
        "risk_assessment",
        "incident_reporting",
        "monitoring_support",
        "evaluation_access",
        "pre_deployment_testing",
        "procurement_testing",
        "contract_documentation",
        "reporting_and_disclosure",
    ],
)
def test_supporting_conduct_never_satisfies_the_headline_rule(
    claims: list[dict[str, Any]], conduct_type: str
) -> None:
    for claim in claims:
        if claim.get("conduct_type") == conduct_type:
            assert not satisfies_headline_rule(claim)


def test_no_us_claim_places_a_duty_on_a_market_provider(claims: list[dict[str, Any]]) -> None:
    assert [
        c["claim_id"]
        for c in claims
        if c["jurisdiction"] == "US" and c.get("actor_type") == "market_provider"
    ] == []


def test_claims_recording_no_duty_bearing_actor(claims: list[dict[str, Any]]) -> None:
    assert {c["claim_id"] for c in claims if "actor_type" not in c} == CLAIMS_WITHOUT_ACTOR_TYPE
    # US-11 names a market provider only prospectively; it bears no current duty.
    us11 = next(c for c in claims if c["claim_id"] == "US-11")
    assert us11["prospective_actor_type"] == "market_provider"
    assert us11["current_actor_type"] == "federal_agency"


def test_government_scoped_duties_stay_government_scoped(claims: list[dict[str, Any]]) -> None:
    for claim in claims:
        if claim.get("binding_scope") in {"federal_agencies_only", "government_contract_only"}:
            assert claim.get("actor_type") != "market_provider"
        if claim["legal_force"] == "contractual":
            assert claim["actor_type"] == "government_vendor"
            assert claim["binding_scope"] == "government_contract_only"


def test_removed_temporary_records_occupy_no_row(dataset: dict[str, Any]) -> None:
    banned = set(REMOVED_TEMPORARY_LOCATORS.values())
    assert [r["row_id"] for r in dataset["records"] if r["source_locator"] in banned] == []
    recorded = {
        e["temporary_row_id"]: e["source_locator"]
        for e in dataset["reconciliation"]["removed_from_main_reviewed_corpus"]
    }
    assert recorded == REMOVED_TEMPORARY_LOCATORS


@pytest.mark.parametrize(
    ("locator", "row_id"),
    [
        ("Article 55(1)(a)", "EU-06"),
        ("Article 55(1)(b)", "EU-07"),
        ("Article 55(1)(c)", "EU-08"),
        ("Article 55(1)(d)", "EU-09"),
    ],
)
def test_corrected_article_55_numbering(
    dataset: dict[str, Any], locator: str, row_id: str
) -> None:
    assert find_record(dataset, row_id)["source_locator"] == locator


def test_every_eu_statutory_locator_keeps_its_row(dataset: dict[str, Any]) -> None:
    for locator, row_id in EU_LOCATOR_TO_ROW.items():
        assert find_record(dataset, row_id)["source_locator"] == locator


# ------------------------------------------------------------------- headline judgments


def test_eu_headline_is_positive_only_for_the_systemic_risk_class(
    claims: list[dict[str, Any]],
) -> None:
    headlines = derive_headline_judgments(claims)
    eu = headlines["EU"]
    assert eu["market_provider"] == "binding_applicable_for_defined_class"
    assert eu["decisive_evidence"] == ["EU-06"]
    assert eu["defined_class"] == "provider of a general-purpose AI model with systemic risk"
    decisive = next(c for c in claims if c["claim_id"] == "EU-06")
    assert decisive["target_system"] == "general_purpose_ai_model_with_systemic_risk"


def test_eu_supporting_and_qualifying_evidence(claims: list[dict[str, Any]]) -> None:
    eu = derive_headline_judgments(claims)["EU"]
    assert eu["supporting_evidence"] == ["EU-01", "EU-02", "EU-07", "EU-10B", "EU-11A"]
    assert eu["qualifying_evidence"] == ["EU-11B"]


def test_us_cross_sector_headline_is_negative(claims: list[dict[str, Any]]) -> None:
    us = derive_headline_judgments(claims)["US"]
    assert us["market_provider_cross_sector"] == {
        "judgment": "no_current_binding_model_evaluation_requirement",
        "evidence": [],
    }
    assert [c["claim_id"] for c in claims if c["jurisdiction"] == "US" and
            satisfies_headline_rule(c)] == []


def test_the_five_us_findings_are_preserved_separately(claims: list[dict[str, Any]]) -> None:
    us = derive_headline_judgments(claims)["US"]
    assert us["voluntary_cross_sector"]["evidence"] == [
        "US-01",
        "US-02",
        "US-03",
        "US-04",
        "US-05A",
    ]
    assert us["federal_agency_government_use"]["evidence"] == ["US-08A", "US-08B"]
    assert us["government_procurement"]["evidence"] == [
        "US-09A",
        "US-09B",
        "US-09C",
        "US-10A",
        "US-10B",
    ]
    assert us["contract_mediated_government_vendor"]["evidence"] == [
        "US-09C",
        "US-10A",
        "US-10B",
    ]
    assert us["proposed_future"]["evidence"] == ["US-11"]


def test_proposed_voluntary_guidance_is_not_proposed_regulation(
    claims: list[dict[str, Any]],
) -> None:
    """US-05B is `adoption_status: proposed` but voluntary; it is not proposed regulation."""
    us = derive_headline_judgments(claims)["US"]
    assert "US-05B" not in us["proposed_future"]["evidence"]
    us05b = next(c for c in claims if c["claim_id"] == "US-05B")
    assert us05b["adoption_status"] == "proposed"
    assert us05b["legal_force"] == "voluntary"


@pytest.mark.parametrize("enforcement_status", sorted(ALLOWED_ENFORCEMENT_STATUS))
def test_enforcement_status_never_decides_the_headline(
    claims: list[dict[str, Any]], enforcement_status: str
) -> None:
    """An unknown enforcement status must not defeat a binding, applicable duty."""
    substituted = [{**claim, "enforcement_status": enforcement_status} for claim in claims]
    positive = [c["claim_id"] for c in substituted if satisfies_headline_rule(c)]
    assert positive == ["EU-06"]


# ----------------------------------------------------------------------- determinism


def test_normalization_is_deterministic(dataset: dict[str, Any]) -> None:
    assert normalize_claims(dataset) == normalize_claims(copy.deepcopy(dataset))


def test_normalization_does_not_mutate_the_reviewed_table(dataset: dict[str, Any]) -> None:
    before = copy.deepcopy(dataset)
    normalize_claims(dataset)
    assert dataset == before


def test_the_module_reads_no_clock_and_no_network() -> None:
    source = (
        ROOT / "apps/ingest/src/writ_ingest/pilot/eu_us_ai_evaluation.py"
    ).read_text(encoding="utf-8")
    for forbidden in (
        "datetime.now",
        "date.today",
        "time.time",
        "random.",
        "httpx",
        "requests",
        "uuid4",
        "os.environ",
    ):
        assert forbidden not in source, f"pilot derivation must stay deterministic: {forbidden}"


@pytest.mark.parametrize("filename", ["records.json", "claims.json", "headline-judgments.json"])
def test_generated_files_match_the_reviewed_table(
    dataset: dict[str, Any], claims: list[dict[str, Any]], filename: str
) -> None:
    """The checked-in artifacts must not drift from the reviewed source."""
    path = ROOT / NORMALIZED_RELATIVE_DIR / filename
    if not path.exists():  # pragma: no cover - emitted by scripts/emit_eu_us_ai_evaluation.py
        pytest.skip(f"{filename} has not been emitted yet")
    stored = json.loads(path.read_text(encoding="utf-8"))
    expected = {
        "records.json": dataset["records"],
        "claims.json": claims,
        "headline-judgments.json": derive_headline_judgments(claims),
    }[filename]
    assert stored == expected


# -------------------------------------------------------------------------- mutations


def test_rejects_making_the_decisive_eu_obligation_voluntary(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    find_record(document, "EU-06")["legal_force"] = "voluntary"
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_dropping_an_unknown_enforcement_status(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    del find_record(document, "EU-01")["enforcement_status"]
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_recoding_unknown_as_not_applicable(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    find_record(document, "EU-01")["enforcement_status"] = "not_applicable"
    with pytest.raises(PilotValidationError, match="was not preserved"):
        run_full_validation(document)


def test_rejects_recoding_not_determinable_as_unknown(dataset: dict[str, Any]) -> None:
    """The three indeterminate enforcement values are distinct reviewed facts."""
    document = mutate(dataset)
    find_record(document, "US-12")["enforcement_status"] = "unknown"
    with pytest.raises(PilotValidationError, match="was not preserved"):
        run_full_validation(document)


def test_rejects_renumbering_a_row(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    find_record(document, "EU-06")["row_id"] = "EU-02"
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_an_article_51_record_in_a_reviewed_row(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    find_record(document, "EU-06")["source_locator"] = "Article 51(1)-(2)"
    with pytest.raises(PilotValidationError, match="must not occupy reviewed row ids"):
        run_full_validation(document)


def test_rejects_an_article_52_record_in_a_reviewed_row(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    find_record(document, "EU-07")["source_locator"] = "Article 52(1)"
    with pytest.raises(PilotValidationError, match="must not occupy reviewed row ids"):
        run_full_validation(document)


def test_rejects_merging_two_bundle_children(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    bundle = find_record(document, "EU-10")
    bundle["derived_claims"] = [c for c in bundle["derived_claims"] if c["claim_id"] != "EU-10B"]
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_dropping_a_bundle_child(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    bundle = find_record(document, "US-10")
    bundle["derived_claims"] = [c for c in bundle["derived_claims"] if c["claim_id"] != "US-10B"]
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_a_pending_review(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    find_record(document, "EU-01")["review_decision"] = "pending"
    with pytest.raises(PilotValidationError, match="non-accepted reviews"):
        run_full_validation(document)


def test_rejects_a_rejected_review(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    find_record(document, "US-01")["review_decision"] = "rejected"
    with pytest.raises(PilotValidationError, match="non-accepted reviews"):
        run_full_validation(document)


def test_rejects_making_a_government_use_control_a_market_duty(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    find_claim(document, "US-08A")["actor_type"] = "market_provider"
    with pytest.raises(PilotValidationError, match="actor_type"):
        run_full_validation(document)


def test_rejects_calling_pre_deployment_testing_model_evaluation(
    dataset: dict[str, Any],
) -> None:
    document = mutate(dataset)
    find_claim(document, "US-08A")["conduct_type"] = "model_evaluation"
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_calling_procurement_testing_model_evaluation(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    find_claim(document, "US-09A")["conduct_type"] = "model_evaluation"
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_calling_documentation_model_evaluation(dataset: dict[str, Any]) -> None:
    """EU-01 requires documentation that includes evaluation results, not evaluation."""
    document = mutate(dataset)
    find_record(document, "EU-01")["conduct_type"] = "model_evaluation"
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_making_voluntary_guidance_binding(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    find_claim(document, "US-05B")["legal_force"] = "binding"
    with pytest.raises(PilotValidationError, match="legal_force"):
        run_full_validation(document)


def test_rejects_making_the_code_of_practice_binding(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    find_record(document, "EU-12")["legal_force"] = "binding"
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_making_a_vendor_contract_duty_a_market_duty(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    claim = find_claim(document, "US-09C")
    claim["actor_type"] = "market_provider"
    claim["binding_scope"] = "government_contract_only"
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_promoting_a_prospective_actor_to_the_duty_bearer(
    dataset: dict[str, Any],
) -> None:
    document = mutate(dataset)
    find_record(document, "US-11")["actor_type"] = "market_provider"
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_promoting_a_recipient_to_the_duty_bearer(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    find_record(document, "EU-02")["actor_type"] = "downstream_provider"
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_a_stale_validation_expectations_block(dataset: dict[str, Any]) -> None:
    document = mutate(dataset)
    document["validation_expectations"]["normalized_claim_count"] = 31
    with pytest.raises(PilotValidationError):
        run_full_validation(document)


def test_rejects_dropping_the_transition_qualification(dataset: dict[str, Any]) -> None:
    """EU-11B's transition period for pre-2025-08-02 models is a substantive qualification."""
    document = mutate(dataset)
    find_claim(document, "EU-11B")["applicability_status"] = "applicable"
    with pytest.raises(PilotValidationError):
        run_full_validation(document)
