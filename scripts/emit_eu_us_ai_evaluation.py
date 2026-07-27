#!/usr/bin/env python3
"""Emit, validate, and materialize the EU-US AI evaluation pilot's normalized records.

Reads the human-reviewed annotation table, generates the normalized claims from its
parent records, derives the headline judgments from those claims, validates the whole
graph, and writes the result under ``pilot/eu-us-ai-evaluation/normalized``.

The reviewed table is never rewritten. Nothing here reads the clock or the network, so
re-running the script on unchanged input produces byte-identical output.
"""

from __future__ import annotations

import argparse
import json

from writ_ingest.corpus.registry import canonical_json_bytes, find_repo_root
from writ_ingest.pilot.eu_us_ai_evaluation import (
    NORMALIZED_RELATIVE_DIR,
    build_pilot,
    summarize,
)

FILES = {
    "records": "records.json",
    "claims": "claims.json",
    "headline_judgments": "headline-judgments.json",
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
    pilot = build_pilot()
    dataset = pilot["dataset"]
    claims = pilot["claims"]

    payloads = {
        "records": dataset["records"],
        "claims": claims,
        "headline_judgments": pilot["headline_judgments"],
    }

    summary = summarize(dataset, claims)
    written: list[str] = []
    if not args.check:
        target = root / NORMALIZED_RELATIVE_DIR
        target.mkdir(parents=True, exist_ok=True)
        for attribute, filename in FILES.items():
            (target / filename).write_bytes(canonical_json_bytes(payloads[attribute]))
            written.append((NORMALIZED_RELATIVE_DIR / filename).as_posix())

    print(
        json.dumps(
            {
                "valid": True,
                "summary": summary,
                "headline_judgments": pilot["headline_judgments"],
                "written": written,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
