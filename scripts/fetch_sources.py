#!/usr/bin/env python3
"""Plan, import, or explicitly execute one registry-governed fetch."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import psycopg
from writ_ingest.corpus.fetch import fetch_live_bytes, plan_seed_fetch
from writ_ingest.corpus.online_store import (
    prepare_online_artifact,
    publish_online_artifact,
)
from writ_ingest.corpus.registry import get_source, load_registry, validate_source_url


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--summit-slug", required=True)
    parser.add_argument("--document-id", required=True)
    parser.add_argument("--source-url")
    parser.add_argument("--registry", type=Path)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--supplied-file", type=Path)
    modes.add_argument("--approved-live-access", action="store_true")
    args = parser.parse_args()

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
            "document_id": args.document_id,
            "summit_slug": args.summit_slug,
            "mode": "dry_run",
            "corpus_objects_written": False,
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        parser.error("DATABASE_URL is required for online corpus publication")
    artifact = prepare_online_artifact(
        logical_id=(
            f"corpus.{args.source_id}.raw.{args.summit_slug}.{args.document_id}"
        ),
        source_id=args.source_id,
        object_kind="raw_source",
        content=payload,
        media_type=media_type,
        summit_slug=args.summit_slug,
        provenance=provenance,
    )
    with psycopg.connect(database_url) as connection:
        result = publish_online_artifact(connection, artifact)
    result.update(
        {
            "source_id": args.source_id,
            "document_id": args.document_id,
            "summit_slug": args.summit_slug,
            "byte_size": artifact.byte_size,
            "media_type": artifact.media_type,
        }
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
