#!/usr/bin/env python3
"""Plan or explicitly acquire one registry-governed source to a caller-owned file."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from writ_ingest.corpus.fetch import fetch_live_bytes, plan_seed_fetch
from writ_ingest.corpus.registry import get_source, load_registry, validate_source_url


def sha256_id(payload: bytes) -> str:
    return f"sha256:{hashlib.sha256(payload).hexdigest()}"


def write_exact_output(path: Path, payload: bytes) -> None:
    try:
        with path.open("xb") as output:
            output.write(payload)
    except FileExistsError as exc:
        raise ValueError(f"refusing to overwrite existing output: {path}") from exc


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--source-url")
    parser.add_argument("--registry", type=Path)
    parser.add_argument("--output", type=Path)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--supplied-file", type=Path)
    modes.add_argument("--approved-live-access", action="store_true")
    args = parser.parse_args()

    acquiring = args.supplied_file is not None or args.approved_live_access
    if acquiring and args.output is None:
        parser.error("--output is required when acquiring source bytes")
    if args.output is not None and args.output.exists():
        parser.error(f"refusing to overwrite existing output: {args.output}")
    if args.output is not None and not args.output.parent.is_dir():
        parser.error(f"output directory does not exist: {args.output.parent}")

    source = get_source(load_registry(args.registry), args.source_id)
    source_url = args.source_url or source["discovery"]["seed_url"]
    if args.supplied_file:
        resolved_url = validate_source_url(source, source_url)
        payload = args.supplied_file.read_bytes()
        media_type = (
            "application/pdf"
            if args.supplied_file.suffix.lower() == ".pdf"
            else "text/html"
        )
        provenance = {
            "acquisition_method": "user_supplied_file",
            "source_url": resolved_url,
            "live_fetch_authorized": False,
        }
    elif args.approved_live_access:
        payload, fetch_metadata = fetch_live_bytes(
            source=source,
            source_url=source_url,
            approved_live_access=True,
        )
        media_type = fetch_metadata.pop("media_type")
        provenance = {
            "acquisition_method": "approved_live_fetch",
            "live_fetch_authorized": True,
            **fetch_metadata,
        }
    else:
        result = {
            **plan_seed_fetch(source),
            "mode": "dry_run",
            "bytes_acquired": False,
            "output_written": False,
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    assert args.output is not None
    try:
        write_exact_output(args.output, payload)
    except ValueError as exc:
        parser.error(str(exc))
    result = {
        "source_id": args.source_id,
        "mode": "acquired",
        "output_path": str(args.output),
        "sha256": sha256_id(payload),
        "byte_size": len(payload),
        "media_type": media_type,
        "acquisition_provenance": provenance,
        "corpus_objects_written": False,
        "evidence_accepted": False,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
