#!/usr/bin/env python3
"""Build a reviewed source manifest without performing live discovery."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from writ_ingest.corpus.manifest import (
    build_blocked_seed_manifest,
    build_discovered_manifest,
    write_immutable_json,
)
from writ_ingest.corpus.registry import get_source, load_registry
from writ_ingest.corpus.validation import validate_record


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--summit-slug", required=True)
    parser.add_argument("--registry", type=Path)
    parser.add_argument("--seed-html", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--observed-at", default="2026-07-24")
    args = parser.parse_args()

    registry = load_registry(args.registry)
    source = get_source(registry, args.source_id)
    if args.seed_html:
        manifest = build_discovered_manifest(
            source,
            summit_slug=args.summit_slug,
            seed_html=args.seed_html.read_bytes(),
        )
    else:
        manifest = build_blocked_seed_manifest(
            source,
            summit_slug=args.summit_slug,
            observed_at=args.observed_at,
        )
    validate_record("source_manifest", manifest)
    if args.output:
        write_immutable_json(args.output, manifest)
    else:
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
