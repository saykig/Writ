"""Leakage-resistant historical benchmark comparison primitives."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from typing import Any

from .models import (
    validate_computed_result,
    validate_historical_label,
    validate_published_result,
)
from .validation import validate_corpus_evaluation_eligibility


class BenchmarkError(ValueError):
    """Benchmark inputs or labels violate the comparison protocol."""


def _canonical_hash(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return f"sha256:{hashlib.sha256(payload).hexdigest()}"


def evaluate_then_compare(
    *,
    dsl_input: dict[str, Any],
    predictor: Callable[[dict[str, Any]], dict[str, Any]],
    official_label_loader: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    """Generate and hash a prediction before loading the official label."""
    forbidden = {"official_label", "historical_label", "original_score", "normalized_score"}
    leaked = forbidden.intersection(dsl_input)
    if leaked:
        raise BenchmarkError(f"DSL input contains hidden label fields: {sorted(leaked)}")

    prediction = predictor(dsl_input)
    prediction_hash = _canonical_hash(prediction)

    official = official_label_loader()
    validate_historical_label(official["historical_label"])
    official_score = official["score"]
    generated_score = prediction.get("score")
    return {
        "schema_version": "1.0.0",
        "prediction": prediction,
        "prediction_hash_before_label_load": prediction_hash,
        "official_label": official,
        "match": generated_score == official_score,
        "review_required": generated_score != official_score,
    }


def evaluate_selected_then_compare(
    *,
    selections: list[dict[str, Any]],
    evaluation_request: dict[str, Any],
    dsl_input: dict[str, Any],
    predictor: Callable[[dict[str, Any]], dict[str, Any]],
    official_label_loader: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    """Gate a normalized corpus benchmark and keep imported/computed results separate."""
    validate_corpus_evaluation_eligibility(selections, evaluation_request)
    forbidden = {
        "official_label",
        "historical_label",
        "published_result",
        "original_score",
        "normalized_score",
    }
    leaked = forbidden.intersection(dsl_input)
    if leaked:
        raise BenchmarkError(f"DSL input contains hidden label fields: {sorted(leaked)}")

    prediction = predictor(dsl_input)
    computed = prediction.get("computed_result")
    try:
        validate_computed_result(computed)
    except ValueError as exc:
        raise BenchmarkError(str(exc)) from exc
    prediction_hash = _canonical_hash(prediction)

    official = official_label_loader()
    validate_historical_label(official["historical_label"])
    published = official["published_result"]
    try:
        validate_published_result(published)
    except ValueError as exc:
        raise BenchmarkError(str(exc)) from exc
    match = None if published is None else computed == published
    return {
        "schema_version": "2.0.0",
        "prediction": prediction,
        "prediction_hash_before_label_load": prediction_hash,
        "published_result": published,
        "writ_computed_result": computed,
        "comparison_status": (
            "published_result_unavailable" if published is None else "compared"
        ),
        "match": match,
        "review_required": published is None or match is False,
    }
