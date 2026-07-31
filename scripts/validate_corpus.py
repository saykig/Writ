#!/usr/bin/env python3
"""Validate available corpus artifacts without creating normalized data."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from writ_ingest.corpus.adapters.g7_2025_ai_sme import G7AiSmeFixtureAdapter
from writ_ingest.corpus.adapters.g20 import G20RioAdapter
from writ_ingest.corpus.validation import validate_corpus_graph, validate_record


def _adapter_counts(output: Any) -> dict[str, int]:
    return {
        "identified_commitments": len(output.commitments),
        "assessment_selections": len(output.selections),
        "compliance_reports": len(output.reports),
        "member_compliance_assessments": len(output.member_assessments),
        "reconciliation_manifests": len(output.reconciliations),
        "review_items": len(output.review_items),
    }


def _validate_output(output: Any) -> None:
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path)
    parser.add_argument(
        "--g7-fixture",
        action="store_true",
        help="Validate the frozen G7 adapter output in memory without writing records.",
    )
    parser.add_argument(
        "--g20-rio",
        action="store_true",
        help="Validate the G20 2024 Rio adapter output in memory without writing records.",
    )
    parser.add_argument(
        "--record",
        action="append",
        default=[],
        metavar="KIND=PATH",
        help="Validate a JSON record using a named corpus schema.",
    )
    args = parser.parse_args()
    validated: list[str] = []
    if args.manifest:
        value = json.loads(args.manifest.read_text(encoding="utf-8"))
        validate_record("source_manifest", value)
        validated.append(args.manifest.as_posix())
    for specification in args.record:
        if "=" not in specification:
            parser.error("--record must be KIND=PATH")
        kind, path_text = specification.split("=", 1)
        path = Path(path_text)
        value = json.loads(path.read_text(encoding="utf-8"))
        validate_record(kind, value)
        validated.append(path.as_posix())
    adapter_counts: dict[str, int] | None = None
    if args.g7_fixture:
        output = G7AiSmeFixtureAdapter().emit()
        _validate_output(output)
        adapter_counts = _adapter_counts(output)
        validated.append("corpora/multilateral/g7/2025-ai-sme (in-memory adapter)")
    if args.g20_rio:
        output = G20RioAdapter().emit()
        _validate_output(output)
        adapter_counts = _adapter_counts(output)
        validated.append("corpora/multilateral/g20/2024-rio (in-memory adapter)")
    print(
        json.dumps(
            {
                "valid": True,
                "validated": validated,
                "adapter_counts": adapter_counts,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
