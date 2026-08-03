"""Fetch, dry-run, sample, or import the Open US Law constitutional subset."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from writ_ingest.corpus.constitutional_law import (
    DATASET_SNAPSHOT,
    fetch_constitution_rows,
    import_constitutions,
    load_constitution_rows,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--sample", type=int)
    parser.add_argument("--max-bytes", type=int, default=10 * 1024 * 1024)
    parser.add_argument(
        "--output", type=Path, default=Path("corpora/us/constitutional-law")
    )
    parser.add_argument("--snapshot", default=DATASET_SNAPSHOT)
    args = parser.parse_args()
    if args.fetch:
        print(json.dumps({"fetched_rows": fetch_constitution_rows(args.cache)}))
    rows = load_constitution_rows(args.cache)
    report = import_constitutions(
        rows,
        args.output,
        dry_run=args.dry_run,
        sample=args.sample,
        max_bytes=args.max_bytes,
        snapshot=args.snapshot,
    )
    print(json.dumps(asdict(report), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
