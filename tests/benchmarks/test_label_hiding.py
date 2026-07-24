from __future__ import annotations

from pathlib import Path

import pytest
from writ_ingest.corpus.benchmark import (
    BenchmarkError,
    evaluate_selected_then_compare,
    evaluate_then_compare,
)
from writ_ingest.corpus.validation import CorpusValidationError


def historical_label(score: str = "+1") -> dict[str, object]:
    return {
        "score": score,
        "historical_label": {
            "label_type": "expert_assigned_historical_score",
            "label_authority": "G20 Research Group",
            "usable_for_training_examples": True,
            "usable_for_evaluation": True,
            "usable_for_automatic_score_transfer": False,
        },
    }


def test_prediction_is_generated_before_official_label_is_loaded() -> None:
    events: list[str] = []

    def predictor(value: dict[str, object]) -> dict[str, object]:
        events.append("prediction")
        assert "official_label" not in value
        return {"score": "0", "reasoning": "synthetic"}

    def loader() -> dict[str, object]:
        events.append("label")
        return historical_label("+1")

    result = evaluate_then_compare(
        dsl_input={"commitment": "synthetic", "evidence": []},
        predictor=predictor,
        official_label_loader=loader,
    )
    assert events == ["prediction", "label"]
    assert result["match"] is False
    assert result["review_required"] is True
    assert result["prediction_hash_before_label_load"].startswith("sha256:")


def test_hidden_label_fields_are_rejected_from_dsl_input() -> None:
    with pytest.raises(BenchmarkError, match="hidden label"):
        evaluate_then_compare(
            dsl_input={"official_label": "+1"},
            predictor=lambda _value: {"score": "+1"},
            official_label_loader=historical_label,
        )


def normalized_selection(status: str = "selected") -> dict[str, object]:
    return {
        "institution": "G20",
        "summit_id": "G20.synthetic",
        "commitment_id": "commitment.synthetic",
        "selection_status": status,
    }


def normalized_label(result: str | None) -> dict[str, object]:
    return {
        "published_result": result,
        "historical_label": historical_label()["historical_label"],
    }


def test_normalized_benchmark_keeps_published_and_computed_results_separate() -> None:
    events: list[str] = []

    def predictor(_value: dict[str, object]) -> dict[str, object]:
        events.append("prediction")
        return {"computed_result": "unresolved", "reasoning": "decisive unknown"}

    def loader() -> dict[str, object]:
        events.append("label")
        return normalized_label("+1")

    result = evaluate_selected_then_compare(
        selections=[normalized_selection()],
        evaluation_request={
            "institution": "G20",
            "summit_id": "G20.synthetic",
            "commitment_id": "commitment.synthetic",
        },
        dsl_input={"commitment": "synthetic", "evidence": []},
        predictor=predictor,
        official_label_loader=loader,
    )
    assert events == ["prediction", "label"]
    assert result["published_result"] == "+1"
    assert result["writ_computed_result"] == "unresolved"
    assert result["match"] is False


@pytest.mark.parametrize("status", ["not_selected", "unknown"])
def test_normalized_benchmark_rejects_ineligible_selection(status: str) -> None:
    with pytest.raises(CorpusValidationError, match="requires selected"):
        evaluate_selected_then_compare(
            selections=[normalized_selection(status)],
            evaluation_request={
                "institution": "G20",
                "summit_id": "G20.synthetic",
                "commitment_id": "commitment.synthetic",
            },
            dsl_input={"commitment": "synthetic", "evidence": []},
            predictor=lambda _value: {"computed_result": "0"},
            official_label_loader=lambda: normalized_label("0"),
        )


def test_missing_published_label_is_not_converted_to_computed_result() -> None:
    result = evaluate_selected_then_compare(
        selections=[normalized_selection()],
        evaluation_request={
            "institution": "G20",
            "summit_id": "G20.synthetic",
            "commitment_id": "commitment.synthetic",
        },
        dsl_input={"commitment": "synthetic", "evidence": []},
        predictor=lambda _value: {"computed_result": "unresolved"},
        official_label_loader=lambda: normalized_label(None),
    )
    assert result["published_result"] is None
    assert result["writ_computed_result"] == "unresolved"
    assert result["comparison_status"] == "published_result_unavailable"
    assert result["match"] is None


def test_production_corpus_code_avoids_disallowed_label_term() -> None:
    root = Path(__file__).resolve().parents[2]
    disallowed = "ground" + "_truth"
    production_paths = [
        root / "apps/ingest/src/writ_ingest/corpus",
        root / "scripts/discover_sources.py",
        root / "scripts/fetch_sources.py",
        root / "scripts/parse_commitments.py",
        root / "scripts/parse_assessments.py",
        root / "scripts/validate_corpus.py",
        root / "scripts/build_benchmarks.py",
    ]
    for path in production_paths:
        files = path.rglob("*.py") if path.is_dir() else [path]
        for file_path in files:
            assert disallowed not in file_path.read_text(encoding="utf-8").lower()
