#!/usr/bin/env python3
"""Emit and validate a generated compatibility projection of the G20 Rio corpus.

The authoritative political records live under
``archive/compatibility/g20/2024-rio``. Optional output goes only to
``internal/infrastructure/generated/g20`` and cannot compete with that corpus as a source of truth.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from writ_ingest.corpus.adapters.g20 import G20RioAdapter
from writ_ingest.corpus.registry import canonical_json_bytes, find_repo_root
from writ_ingest.corpus.validation import validate_corpus_graph
from writ_ingest.corpus.vocabulary import (
    load_vocabulary,
    validate_vocabulary_review_items,
)

OUTPUT_DIR = Path("internal/infrastructure/generated/g20/2024-rio")
FILES = {
    "commitments": "commitments.json",
    "selections": "selections.json",
    "reports": "reports.json",
    "member_assessments": "member_assessments.json",
    "reconciliations": "reconciliations.json",
    "review_items": "review_queue.json",
}


def _summary(output: Any) -> dict[str, Any]:
    published = [
        a for a in output.member_assessments if a["score_status"] == "published"
    ]
    missing = [a for a in output.member_assessments if a["score_status"] == "missing"]
    by_stage = {
        report["report_stage"]: sum(
            1 for a in output.member_assessments if a["report_id"] == report["report_id"]
        )
        for report in output.reports
    }
    score_distribution: dict[str, int] = {}
    for assessment in output.member_assessments:
        key = "null" if assessment["published_result"] is None else assessment["published_result"]
        score_distribution[key] = score_distribution.get(key, 0) + 1
    reconciliation = output.reconciliations[0] if output.reconciliations else {}
    return {
        "identified_commitments": len(output.commitments),
        "assessment_selections": len(output.selections),
        "selected": sum(
            1 for s in output.selections if s["selection_status"] == "selected"
        ),
        "not_selected": sum(
            1 for s in output.selections if s["selection_status"] == "not_selected"
        ),
        "unknown": sum(
            1 for s in output.selections if s["selection_status"] == "unknown"
        ),
        "compliance_reports": len(output.reports),
        "member_compliance_assessments": len(output.member_assessments),
        "member_assessments_by_stage": by_stage,
        "published_scores": len(published),
        "missing_scores": len(missing),
        "score_distribution": score_distribution,
        "review_items": len(output.review_items),
        "inventory_count_expected": reconciliation.get("expected_inventory_count"),
        "selected_count_expected": reconciliation.get("expected_selected_count"),
        "reconciliation_status": reconciliation.get("validation_status"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate and print the summary without writing files.",
    )
    args = parser.parse_args()

    root = find_repo_root()
    output = G20RioAdapter().emit()
    validate_corpus_graph(
        commitments=list(output.commitments),
        selections=list(output.selections),
        reports=list(output.reports),
        member_assessments=list(output.member_assessments),
        reconciliations=list(output.reconciliations),
        review_items=list(output.review_items),
        passage_ids=set(output.passage_ids),
        source_document_ids=set(output.source_document_ids),
    )
    # G20 introduces only reviewed vocabulary; assert no proposed mapping is left uncovered.
    vocabulary = load_vocabulary()
    g20_unreviewed = [
        mapping
        for mapping in vocabulary["mappings"]
        if mapping["source_id"] == "g20_research_group"
        and mapping["mapping_status"] != "reviewed"
    ]
    if g20_unreviewed:
        validate_vocabulary_review_items(vocabulary, list(output.review_items))

    summary = _summary(output)
    written: list[str] = []
    if not args.check:
        target = root / OUTPUT_DIR
        target.mkdir(parents=True, exist_ok=True)
        for attribute, filename in FILES.items():
            records = list(getattr(output, attribute))
            (target / filename).write_bytes(canonical_json_bytes(records))
            written.append((OUTPUT_DIR / filename).as_posix())

    print(
        json.dumps(
            {"valid": True, "summary": summary, "written": written},
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
