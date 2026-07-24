#!/usr/bin/env python3
"""Validate commitment parsing prerequisites and stop before unsupported parsing."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from writ_ingest.corpus.parsing import RawSourcesUnavailableError, require_raw_documents


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    try:
        require_raw_documents(manifest)
    except RawSourcesUnavailableError as exc:
        parser.error(str(exc))
    parser.error(
        "no approved commitment parser adapter is installed; stopped without normalized output"
    )


if __name__ == "__main__":
    raise SystemExit(main())
