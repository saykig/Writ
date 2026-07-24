"""Deterministic manifests and immutable offline validation output."""

from __future__ import annotations

import hashlib
import os
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

from .registry import UrlPolicyError, canonical_json_bytes, validate_source_url


class ManifestError(RuntimeError):
    """A manifest or raw-layer operation is unsafe."""


class _SectionLinkParser(HTMLParser):
    def __init__(self, category_sections: dict[str, str]) -> None:
        super().__init__(convert_charrefs=True)
        self._categories_by_anchor: dict[str, list[str]] = {}
        for category, anchor in category_sections.items():
            self._categories_by_anchor.setdefault(anchor, []).append(category)
        self._active_anchor: str | None = None
        self.links: list[tuple[str, tuple[str, ...]]] = []

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        attributes = dict(attrs)
        anchor_marker = attributes.get("name") or attributes.get("id")
        if anchor_marker:
            self._active_anchor = (
                anchor_marker if anchor_marker in self._categories_by_anchor else None
            )
        if tag.lower() != "a" or self._active_anchor is None:
            return
        href = attributes.get("href")
        if href:
            categories = tuple(sorted(self._categories_by_anchor[self._active_anchor]))
            self.links.append((href, categories))


def sha256_id(data: bytes) -> str:
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


def _with_manifest_id(body: dict[str, Any]) -> dict[str, Any]:
    unsigned = {key: value for key, value in body.items() if key != "manifest_id"}
    identifier = sha256_id(canonical_json_bytes(unsigned))
    return {"schema_version": "2.0.0", "manifest_id": identifier, **unsigned}


def build_blocked_seed_manifest(
    source: dict[str, Any],
    *,
    summit_slug: str,
    observed_at: str,
) -> dict[str, Any]:
    """Create a deterministic seed-only manifest without fetching anything."""
    discovery = source["discovery"]
    body = {
        "source_id": source["id"],
        "institution": source["institution"],
        "summit_slug": summit_slug,
        "live_fetch_authorized": False,
        "raw_files_available": False,
        "access_observations": [
            {
                "access_method": "browser",
                "status": "failed",
                "observed_at": observed_at,
                "failure_reason": "iso_8859_1_decode_error",
                "notes": "Browser fetch could not decode the seed page.",
            },
            {
                "access_method": "direct_http",
                "status": "succeeded",
                "observed_at": observed_at,
                "failure_reason": None,
                "notes": (
                    "Bounded inspection succeeded previously; live corpus fetching is not "
                    "authorized."
                ),
            },
        ],
        "documents": [
            {
                "document_id": f"{source['id']}.seed_index",
                "category": "seed_index",
                "source_url": discovery["seed_url"],
                "section_anchor": discovery["section_anchor"],
                "report_stage": None,
                "fetch_status": "blocked",
                "skip_reason": "live_access_not_approved_and_no_source_file_provided",
                "storage_backend": None,
                "storage_object_id": None,
                "sha256": None,
                "byte_size": None,
                "media_type": None,
                "warnings": ["browser_access_failed", "raw_source_unavailable"],
            }
        ],
    }
    return _with_manifest_id(body)


def build_discovered_manifest(
    source: dict[str, Any],
    *,
    summit_slug: str,
    seed_html: bytes,
) -> dict[str, Any]:
    """Discover allowlisted links from registered sections in supplied seed HTML."""
    discovery = source["discovery"]
    parser = _SectionLinkParser(discovery.get("category_sections", {}))
    parser.feed(seed_html.decode("iso-8859-1"))
    unique: dict[str, tuple[str, ...]] = {}
    rejected_count = 0
    for href, categories in parser.links:
        candidate = urljoin(discovery["seed_url"], href)
        try:
            request_url = validate_source_url(source, candidate)
        except UrlPolicyError:
            rejected_count += 1
            continue
        prior = set(unique.get(request_url, ()))
        unique[request_url] = tuple(sorted(prior.union(categories)))

    documents: list[dict[str, Any]] = []
    for request_url, categories in sorted(unique.items()):
        identifier = hashlib.sha256(request_url.encode("utf-8")).hexdigest()[:16]
        documents.append(
            {
                "document_id": f"{source['id']}.candidate.{identifier}",
                "category": categories[0],
                "candidate_categories": list(categories),
                "source_url": request_url,
                "section_anchor": discovery["category_sections"][categories[0]],
                "report_stage": None,
                "fetch_status": "planned",
                "skip_reason": None,
                "storage_backend": None,
                "storage_object_id": None,
                "sha256": None,
                "byte_size": None,
                "media_type": None,
                "warnings": ["human_manifest_review_required"],
            }
        )
    if not documents:
        raise ManifestError("supplied seed HTML yielded no allowlisted category links")
    body = {
        "source_id": source["id"],
        "institution": source["institution"],
        "summit_slug": summit_slug,
        "live_fetch_authorized": False,
        "raw_files_available": True,
        "access_observations": [
            {
                "access_method": "provided_file",
                "status": "succeeded",
                "observed_at": None,
                "failure_reason": None,
                "notes": (
                    f"Discovered from immutable supplied HTML; {rejected_count} "
                    "non-allowlisted links were rejected."
                ),
            }
        ],
        "documents": documents,
    }
    return _with_manifest_id(body)


def write_immutable_json(path: Path, value: dict[str, Any]) -> bool:
    """Create JSON atomically; return False when identical content already exists."""
    payload = canonical_json_bytes(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() == payload:
            return False
        raise ManifestError(f"refusing to overwrite immutable JSON: {path}")
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        with temporary.open("xb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()
    return True
