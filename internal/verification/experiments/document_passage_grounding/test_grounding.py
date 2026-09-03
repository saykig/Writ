from __future__ import annotations

import copy
import json
from dataclasses import asdict, replace
from unittest.mock import patch

import pytest

from .ground import (
    ground,
    text_hash,
)
from .run import (
    REPORT,
    compare,
    documents,
    load_inputs,
    make_report,
)


@pytest.fixture(scope="module")
def inputs():
    return load_inputs()


@pytest.fixture(scope="module")
def docs(inputs):
    return documents(inputs)


@pytest.fixture(scope="module")
def report(inputs):
    return make_report(inputs)


def test_all_existing_reviewed_frozen_references_are_included(report):
    assert {case["passage_id"] for case in report["reviewed_cases"]} == {
        "ecfr.title15_cfr_part_285.section_285_9_a",
        "ecfr.title15_cfr_part_285.section_285_9_d",
        "nist.handbook_150.competence",
        "nist.handbook_150.accreditation_decision",
    }
    for case in report["reviewed_cases"]:
        assert case["grounding"]["identity_verified"]
        assert case["grounding"]["candidate_count"] == 1
        assert case["repeated_results_identical"]
        assert case["comparison"]["stored_quote_self_hash_matches"]


def test_xml_profile_and_pdf_falsification_are_not_test_success_claims(report):
    for case in report["reviewed_cases"]:
        comparison = case["comparison"]
        assert not comparison["raw_utf8_equals_stored_quote"]
        if case["passage_id"].startswith("ecfr."):
            assert (
                comparison["classification"]
                == "DETERMINISTIC_EXTRACTION_PROFILE_REQUIRED"
            )
            assert comparison["profiled_utf8_equals_stored_quote"]
            assert comparison["profiled_hash_equals_stored_hash"]
        else:
            assert comparison["classification"] == "LOCATOR_CONTRACT_INSUFFICIENT"
            assert not comparison["profiled_utf8_equals_stored_quote"]
            assert not comparison["profiled_hash_equals_stored_hash"]
    assert report["overall_conclusion"] == "CURRENT_LOCATOR_MODEL_INSUFFICIENT"


def test_pdf_wording_extent_and_line_wrapping_remain_visible(report):
    cases = {case["passage_id"]: case for case in report["reviewed_cases"]}
    competence = cases["nist.handbook_150.competence"]
    assert "based on evaluation" in competence["grounding"]["extracted_passage"]
    assert "based on the evaluation" in competence["comparison"]["stored_quote"]
    assert "\ncompetence" in competence["grounding"]["candidates"][0]["raw_text"]
    assert "Fulfillment" in competence["grounding"]["extracted_passage"]
    decision = cases["nist.handbook_150.accreditation_decision"]
    assert decision["comparison"]["stored_quote_is_proper_prefix_of_profiled_passage"]
    assert "NOTE" in decision["grounding"]["extracted_passage"]


def test_absence_ambiguity_and_page_boundaries(report):
    controls = {case["case"]: case for case in report["controls"]}
    for name in ["xml_nonexistent_neighbor", "pdf_nonexistent_neighbor"]:
        result = controls[name]["grounding"]
        assert result["status"] == "no_candidate"
        assert result["candidate_count"] == 0
        assert result["extracted_passage"] is None
    ambiguity = controls["pdf_contents_body_ambiguity"]["grounding"]
    assert ambiguity["status"] == "ambiguous"
    assert ambiguity["candidate_count"] == 2
    assert [item["pages"] for item in ambiguity["candidates"]] == [(4,), (26,)]
    assert ambiguity["extracted_passage"] is None
    assert ambiguity["passage_hash"] is None
    boundary = controls["pdf_cross_page_probe"]["grounding"]["candidates"][0]
    assert boundary["pages"] == (9, 10)
    assert "\f" in boundary["raw_text"]
    assert (
        "This publication is available free of charge" in boundary["steps"][-1]["text"]
    )
    hyphenated = controls["pdf_hyphenation_and_ambiguity_probe"]["grounding"]
    assert hyphenated["status"] == "ambiguous"
    assert "NVLAP-\n\f" in hyphenated["candidates"][1]["raw_text"]
    assert "NVLAP- \f" in hyphenated["candidates"][1]["steps"][-1]["text"]


@pytest.mark.parametrize(
    "source,kind,locator",
    [
        ("ecfr.title15_cfr_part_285", "application/xml", "15 CFR § 285.9(a)"),
        (
            "nist.handbook_150",
            "application/pdf",
            "NIST Handbook 150:2020, clause 1.3.5",
        ),
    ],
)
def test_altered_bytes_or_declarations_fail_before_any_parser(
    docs, source, kind, locator
):
    document = docs[source]
    mutations = [
        replace(document, content=b"!" + document.content[1:]),
        replace(
            document,
            declared_hashes=document.declared_hashes
            + (("disagreement", "sha256:bad"),),
        ),
        replace(document, evidence_versions=("different-version",)),
        replace(document, declared_hashes=()),
    ]
    module = ground.__module__
    with (
        patch(module + ".xml_candidates", side_effect=AssertionError("parser called")),
        patch(module + ".pdf_candidates", side_effect=AssertionError("parser called")),
    ):
        for mutation in mutations:
            result = ground(mutation, kind, locator)
            assert result.status == "source_capture_mismatch"
            assert result.engine is None
            assert result.candidate_count == 0
            assert result.passage_hash is None


def test_changed_quotes_and_hashes_cannot_influence_extraction(inputs, report):
    changed = copy.deepcopy(inputs)
    for ref in changed["evidence"]:
        ref["quote"] = "This replacement is not an extraction input."
        ref["passage_hash"] = text_hash(ref["quote"])
    changed_report = make_report(changed)
    for before, after in zip(
        report["reviewed_cases"], changed_report["reviewed_cases"], strict=True
    ):
        assert before["grounding"] == after["grounding"]
        assert not after["comparison"]["profiled_utf8_equals_stored_quote"]
        assert before["altered_oracle_control"]["grounding_unchanged"]


def test_classification_requires_both_bytes_and_hash_and_reproducibility(inputs, docs):
    oracle = inputs["evidence"][0]
    result = ground(docs[oracle["source_id"]], "application/xml", oracle["locator"])
    before = asdict(result)
    assert compare(result, oracle, False)["classification"] == "NOT_REPRODUCIBLE"
    assert compare(result, {**oracle, "passage_hash": "sha256:wrong"})[
        "classification"
    ] == ("LOCATOR_CONTRACT_INSUFFICIENT")
    raw = result.candidates[0].raw_text
    assert compare(result, {"quote": raw, "passage_hash": text_hash(raw)})[
        "classification"
    ] == ("EXACT_GROUNDING_CONFIRMED")
    assert before == asdict(result)


def test_wrong_title_and_unsupported_locator_do_not_fall_back(docs):
    doc = docs["ecfr.title15_cfr_part_285"]
    assert ground(doc, "application/xml", "16 CFR § 285.9(a)").status == "no_candidate"
    assert (
        ground(doc, "application/xml", "near section 285.9").status
        == "unsupported_locator"
    )
    assert ground(doc, "text/html", "15 CFR § 285.9(a)").status == "unsupported_locator"


def test_parser_failure_is_explicit_and_returns_no_passage(docs):
    module = ground.__module__
    with patch(module + ".xml_candidates", side_effect=ValueError("failed extraction")):
        result = ground(
            docs["ecfr.title15_cfr_part_285"], "application/xml", "15 CFR § 285.9(a)"
        )
    assert result.status == "extraction_error"
    assert result.diagnostic == "DPG_EXTRACTION_ERROR:ValueError"
    assert result.extracted_passage is None
    assert result.passage_hash is None


def test_report_reproduction_is_scoped_to_the_recorded_engine(report):
    # Do not pretend that unconstrained future PyMuPDF versions reproduce the recorded engine.
    recorded = json.loads(REPORT.read_text())
    engines = lambda value: [
        case["grounding"]["engine"] for case in value["reviewed_cases"]
    ]
    if engines(recorded) != engines(report):
        pytest.skip(
            "Extraction engine changed; run --check to expose and review report drift"
        )
    assert json.loads(json.dumps(report)) == recorded
