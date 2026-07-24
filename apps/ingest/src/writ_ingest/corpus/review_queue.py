"""Deterministic review-item construction for unsafe or incomplete extraction."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def make_review_item(
    *,
    source_id: str,
    passage_id: str | None,
    page_or_section: str | None,
    issue_type: str,
    parser_version: str,
    affected_record_ids: list[str],
    original_source_text: str | None,
) -> dict[str, Any]:
    """Build a stable pending review item without inventing a normalized value."""
    identity = {
        "source_id": source_id,
        "passage_id": passage_id,
        "page_or_section": page_or_section,
        "issue_type": issue_type,
        "parser_version": parser_version,
        "affected_record_ids": sorted(affected_record_ids),
        "original_source_text": original_source_text,
    }
    payload = json.dumps(identity, sort_keys=True, separators=(",", ":")).encode("utf-8")
    digest = hashlib.sha256(payload).hexdigest()[:24]
    return {
        "schema_version": "2.0.0",
        "record_type": "corpus_review_item",
        "review_item_id": f"review.{digest}",
        "source_id": source_id,
        "source_location": {
            "passage_id": passage_id,
            "page_or_section": page_or_section,
        },
        "issue_type": issue_type,
        "parser_version": parser_version,
        "affected_record_ids": sorted(set(affected_record_ids)),
        "original_source_text": original_source_text,
        "review_status": "pending",
    }
