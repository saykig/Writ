"""Controlled source-term mappings that cannot change score semantics."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator, FormatChecker

from .registry import find_repo_root, load_registry
from .validation import CorpusValidationError, load_schema

VOCABULARY_RELATIVE_PATH = Path("config/corpus_vocabulary.yml")
SCORE_TERMS = frozenset({"-1", "0", "+1", "not_applicable", "unresolved"})


@dataclass(frozen=True)
class VocabularyResolution:
    mapping_id: str
    source_term: str
    canonical_term: str | None
    mapping_status: str
    requires_review: bool


def load_vocabulary(path: Path | None = None) -> dict[str, Any]:
    """Load and validate the canonical controlled-vocabulary registry."""
    root = find_repo_root()
    vocabulary_path = path or root / VOCABULARY_RELATIVE_PATH
    try:
        value = yaml.safe_load(vocabulary_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise CorpusValidationError(
            f"corpus vocabulary registry is missing: {vocabulary_path}"
        ) from exc
    if not isinstance(value, dict):
        raise CorpusValidationError("corpus vocabulary registry must be a mapping")

    schema = load_schema("corpus_vocabulary", root=root)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(value), key=lambda item: list(item.absolute_path))
    if errors:
        rendered = "; ".join(
            f"/{'/'.join(str(part) for part in error.absolute_path)}: {error.message}"
            for error in errors[:20]
        )
        raise CorpusValidationError(f"invalid corpus vocabulary: {rendered}")

    source_ids = {source["id"] for source in load_registry()["sources"]}
    mapping_ids: set[str] = set()
    mapping_keys: set[tuple[str, str, str]] = set()
    for mapping in value["mappings"]:
        identifier = mapping["mapping_id"]
        if identifier in mapping_ids:
            raise CorpusValidationError(f"duplicate vocabulary mapping id: {identifier}")
        mapping_ids.add(identifier)
        key = (mapping["namespace"], mapping["source_id"], mapping["source_term"])
        if key in mapping_keys:
            raise CorpusValidationError(f"duplicate vocabulary source mapping: {key}")
        mapping_keys.add(key)
        if mapping["source_id"] not in source_ids:
            raise CorpusValidationError(
                f"vocabulary mapping {identifier} references unregistered source "
                f"{mapping['source_id']}"
            )
        terms = {mapping["source_term"], mapping.get("canonical_term")}
        if SCORE_TERMS.intersection(term for term in terms if term is not None):
            raise CorpusValidationError(
                f"vocabulary mapping {identifier} attempts to map a closed score term"
            )
    return value


def resolve_vocabulary(
    vocabulary: dict[str, Any],
    *,
    namespace: str,
    source_id: str,
    source_term: str,
) -> VocabularyResolution:
    """Resolve one exact source term; only reviewed mappings normalize production data."""
    matches = [
        mapping
        for mapping in vocabulary["mappings"]
        if mapping["namespace"] == namespace
        and mapping["source_id"] == source_id
        and mapping["source_term"] == source_term
    ]
    if len(matches) != 1:
        raise CorpusValidationError(
            f"no unique vocabulary mapping for {namespace}:{source_id}:{source_term}"
        )
    mapping = matches[0]
    reviewed = mapping["mapping_status"] == "reviewed"
    return VocabularyResolution(
        mapping_id=mapping["mapping_id"],
        source_term=source_term,
        canonical_term=mapping["canonical_term"] if reviewed else None,
        mapping_status=mapping["mapping_status"],
        requires_review=not reviewed,
    )


def validate_vocabulary_review_items(
    vocabulary: dict[str, Any],
    review_items: list[dict[str, Any]],
) -> None:
    """Require review coverage for every proposed or unmapped mapping."""
    reviewed_ids = {
        affected
        for item in review_items
        for affected in item.get("affected_record_ids", [])
        if item.get("issue_type")
        in {"proposed_vocabulary_mapping", "unmapped_vocabulary"}
    }
    for mapping in vocabulary["mappings"]:
        if mapping["mapping_status"] != "reviewed" and mapping["mapping_id"] not in reviewed_ids:
            raise CorpusValidationError(
                f"vocabulary mapping {mapping['mapping_id']} requires a review item"
            )
