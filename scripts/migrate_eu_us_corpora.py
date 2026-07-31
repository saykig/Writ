#!/usr/bin/env python3
"""Emit or verify the independent EU and US AI-governance corpora."""

from __future__ import annotations

import argparse
import json

from writ_ingest.corpus.eu_us_ai_governance import (
    validate_active_corpora,
    write_corpus_documents,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify checked-in corpus files instead of rewriting them.",
    )
    args = parser.parse_args()
    write_corpus_documents(check=args.check)
    summary = validate_active_corpora()
    print(json.dumps({"valid": True, "summary": summary}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
