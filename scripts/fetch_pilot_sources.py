#!/usr/bin/env python3
"""Retrieve the source documents behind the reviewed EU-US AI evaluation pilot.

The reviewed annotation table records a `source_locator` for every row but never
the text at that locator, where it came from, or when it was retrieved. Writ
cannot evaluate a corpus without that provenance, so this script supplies it: it
fetches each document listed in `pilot/eu-us-ai-evaluation/sources/sources.yml`,
records the SHA-256 of the bytes it actually received, and lifts the verbatim
passage each row cites.

Nothing here paraphrases. A locator that cannot be resolved in the retrieved
document produces no passage and an entry in the discrepancy report, so a gap
stays visible instead of being filled in.

The output is committed, and tests read it offline. This script is run by hand
when a source needs refreshing, never from a test.

Run: python3 scripts/fetch_pilot_sources.py [--offline]
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/ingest/src"))

from writ_ingest.corpus.registry import (
    canonical_json_bytes,
    find_repo_root,
)

PILOT_DIR = Path("pilot/eu-us-ai-evaluation")
SOURCES_PATH = PILOT_DIR / "sources" / "sources.yml"
CACHE_DIR = PILOT_DIR / "sources" / "cache"
OUT_DIR = PILOT_DIR / "provenance"

USER_AGENT = "writ-pilot-source-fetcher/1.0 (+https://github.com/saykig/Writ)"


def fetch(uri: str, cache: Path, offline: bool) -> bytes:
    """Return the document bytes, from cache when offline."""
    if offline or cache.exists():
        if not cache.exists():
            raise SystemExit(f"--offline given but no cached copy for {uri}")
        return cache.read_bytes()
    request = urllib.request.Request(uri, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        body: bytes = response.read()
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(body)
    return body


def pdf_text(raw: bytes) -> list[tuple[int, str]]:
    """Flatten a PDF to `(page_number, paragraph)` pairs."""
    import fitz  # imported lazily so the HTML path needs no PDF toolchain

    document = fitz.open(stream=raw, filetype="pdf")
    out: list[tuple[int, str]] = []
    for index in range(document.page_count):
        for block in re.split(r"\n(?=\s*[A-Z0-9])", document[index].get_text()):
            paragraph = " ".join(block.split())
            if paragraph:
                out.append((index + 1, paragraph))
    return out


def phrase_locator(
    paragraphs: list[tuple[int | None, str]], phrase: str
) -> tuple[str, int | None] | None:
    """The paragraph containing `phrase`, with its page number if it has one."""
    needle = phrase.lower()
    for page, paragraph in paragraphs:
        if needle in paragraph.lower():
            return paragraph, page
    return None


# Tags that end a paragraph. Inline markup inside one does not, so a sentence
# split across <strong>/<a>/<em> stays whole.
BLOCK_TAGS = (
    "p|div|li|tr|section|article|header|footer|main|aside|nav|"
    "h[1-6]|ul|ol|dl|dt|dd|table|thead|tbody|blockquote|br|hr|figure|figcaption"
)


def html_paragraphs(raw: bytes) -> list[tuple[int | None, str]]:
    """Flatten an HTML document to paragraphs, with no page number.

    Web pages carry no pagination, so an anchor into one is located by its
    phrase alone. Splitting on block-level tags only keeps a sentence together
    when the page wraps part of it in inline markup, which is common: a draft's
    title in <strong> followed by its description would otherwise arrive as two
    fragments and quote as one. The phrase is stored with the passage either
    way, so the extraction can be rechecked against the retrieved bytes.
    """
    text = raw.decode("utf-8", errors="replace")
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(rf"</?(?:{BLOCK_TAGS})\b[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return [
        (None, paragraph)
        for paragraph in (" ".join(line.split()) for line in text.split("\n"))
        if paragraph
    ]


def to_text(raw: bytes) -> list[str]:
    """Flatten an HTML document to non-empty text lines, entities resolved."""
    text = raw.decode("utf-8", errors="replace")
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = html.unescape(text)
    text = re.sub(r"[ \t\xa0]+", " ", text)
    return [line.strip() for line in text.split("\n") if line.strip()]


def article_lines(lines: list[str], number: str) -> list[str]:
    """The body of `Article <number>`, up to the next article heading."""
    heading = f"Article {number}"
    try:
        start = lines.index(heading)
    except ValueError:
        return []
    body = [lines[start]]
    for line in lines[start + 1 :]:
        if re.fullmatch(r"Article \d+", line):
            break
        body.append(line)
    return body


def eu_locator(lines: list[str], locator: str) -> tuple[str, str] | None:
    """Resolve an EU AI Act locator to `(quote, dom_path)`.

    Handles `Article 55(1)(a)`, `Article 53(2)`, and a bare `Article 113`.
    Returns None when the locator does not resolve, which is recorded rather
    than guessed at.
    """
    match = re.search(r"Article (\d+)(?:\((\d+)\))?(?:\(([a-z])\))?", locator)
    if not match:
        return None
    number, paragraph, point = match.groups()
    body = article_lines(lines, number)
    if not body:
        return None

    if paragraph is None:
        # The whole article, minus its heading line.
        return " ".join(body[1:]), f"article[{number}]"

    # Find the numbered paragraph, e.g. a line starting "1." or "3.".
    para_start = None
    for index, line in enumerate(body):
        if re.match(rf"^{paragraph}\.\s", line):
            para_start = index
            break
    if para_start is None:
        return None

    para_end = len(body)
    for index in range(para_start + 1, len(body)):
        if re.match(r"^\d+\.\s", body[index]):
            para_end = index
            break
    paragraph_body = body[para_start:para_end]

    if point is None:
        return " ".join(paragraph_body), f"article[{number}]/para[{paragraph}]"

    # Points render as a bare "(a)" line followed by its text.
    for index, line in enumerate(paragraph_body):
        if line == f"({point})":
            collected: list[str] = []
            for candidate in paragraph_body[index + 1 :]:
                if re.fullmatch(r"\([a-z]\)", candidate):
                    break
                collected.append(candidate)
            if not collected:
                return None
            return (
                " ".join(collected),
                f"article[{number}]/para[{paragraph}]/point[{point}]",
            )
    return None


RESOLVERS = {"eu_article": eu_locator}

PDF_STYLES = {"phrase_anchor"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Use the cached documents instead of fetching.",
    )
    args = parser.parse_args()

    root = find_repo_root()
    sources = yaml.safe_load((root / SOURCES_PATH).read_text(encoding="utf-8"))
    dataset = yaml.safe_load(
        (root / PILOT_DIR / "annotations" / "human-reviewed.yaml").read_text(encoding="utf-8")
    )

    retrieved_at = datetime.now(tz=UTC).date().isoformat()
    document_versions: list[dict[str, Any]] = []
    passages: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []

    by_instrument = {source["instrument"]: source for source in sources["sources"]}

    for source in sources["sources"]:
        raw = fetch(
            source["uri"],
            root / CACHE_DIR / f"{source['document_id']}.bin",
            args.offline,
        )
        digest = "sha256:" + hashlib.sha256(raw).hexdigest()
        document_versions.append(
            {
                "id": f"dv-{source['document_id']}",
                "document_id": source["document_id"],
                "title": " ".join(source["title"].split()),
                "uri": source["uri"],
                "media_type": source["media_type"],
                "retrieved_at": f"{retrieved_at}T00:00:00Z",
                "issued_at": f"{source['issued_at']}T00:00:00Z",
                "sha256": digest,
                "publisher": source["publisher"],
                "source_tier": source["source_tier"],
            }
        )
        if source["locator_style"] == "phrase_anchor":
            # A phrase anchor works the same way on either medium; only the
            # flattening differs, and only a PDF yields a page number.
            source["_paragraphs"] = (
                pdf_text(raw)
                if source["media_type"] == "application/pdf"
                else html_paragraphs(raw)
            )
        else:
            source["_lines"] = to_text(raw)
        print(f"fetched {source['instrument']}: {len(raw)} bytes, {digest[:23]}…")

    def phrase_passage(
        source: dict[str, Any], row_id: str, phrase: str
    ) -> dict[str, Any] | None:
        """A passage for `row_id` at `phrase`, or None if the phrase is absent."""
        found = phrase_locator(source["_paragraphs"], phrase)
        if found is None:
            return None
        quote, page = found
        passage: dict[str, Any] = {
            "id": f"passage-{row_id.lower()}",
            "row_id": row_id,
            "document_version_id": f"dv-{source['document_id']}",
            "anchor_type": "pdf_text" if page is not None else "html_dom",
            # The phrase used to locate the passage, recorded so the extraction
            # can be checked rather than taken on trust.
            "anchor_phrase": phrase,
            "quote": quote,
            "anchor_hash": "sha256:" + hashlib.sha256(quote.encode("utf-8")).hexdigest(),
            "language": "en",
        }
        if page is not None:
            passage["page_number"] = page
        return passage

    def resolve_children(record: dict[str, Any]) -> None:
        """Give a bundle's children their own passages where one is registered.

        A source bundle groups claims that cite different things: US-05A points
        at CAISI's published guidelines and US-05B at its draft benchmark
        practices, both on one page. Without a per-child anchor both would
        inherit the parent's passage, and the snapshot would quote the wrong
        text at one of them. A child with no anchor of its own still inherits,
        which is correct where the children share a provision.
        """
        for child in record.get("derived_claims") or []:
            child_id = child["claim_id"]
            # A child may name its own instrument; fall back to the bundle's.
            source = by_instrument.get(child.get("instrument", "")) or by_instrument.get(
                record["instrument"]
            )
            if source is None or source["locator_style"] != "phrase_anchor":
                continue
            phrase = (source.get("anchors") or {}).get(child_id)
            if not phrase:
                continue
            passage = phrase_passage(source, child_id, phrase)
            if passage is None:
                unresolved.append(
                    {
                        "row_id": child_id,
                        "instrument": child.get("instrument", record["instrument"]),
                        "source_locator": " ".join(record["source_locator"].split()),
                        "reason": "anchor phrase not found in the retrieved document",
                    }
                )
                continue
            passages.append(passage)

    # Resolve every reviewed row against its instrument's document.
    for record in dataset["records"]:
        resolve_children(record)
        instrument = record["instrument"]
        locator = " ".join(record["source_locator"].split())
        source = by_instrument.get(instrument)
        if source is None:
            unresolved.append(
                {
                    "row_id": record["row_id"],
                    "instrument": instrument,
                    "source_locator": locator,
                    "reason": "no source document is registered for this instrument",
                }
            )
            continue

        if source["locator_style"] == "phrase_anchor":
            phrase = (source.get("anchors") or {}).get(record["row_id"])
            passage = phrase_passage(source, record["row_id"], phrase) if phrase else None
            if passage is None:
                # A bundle whose children all resolved on their own needs no
                # passage of its own; it carries no legal force to quote.
                resolved_children = {item["row_id"] for item in passages}
                children = [
                    child["claim_id"] for child in (record.get("derived_claims") or [])
                ]
                if children and all(child in resolved_children for child in children):
                    continue
                unresolved.append(
                    {
                        "row_id": record["row_id"],
                        "instrument": instrument,
                        "source_locator": locator,
                        "reason": (
                            "no anchor phrase registered for this row"
                            if not phrase
                            else "anchor phrase not found in the retrieved document"
                        ),
                    }
                )
                continue
            passages.append(passage)
            continue

        resolver = RESOLVERS[source["locator_style"]]
        resolved = resolver(source["_lines"], locator)
        if resolved is None:
            unresolved.append(
                {
                    "row_id": record["row_id"],
                    "instrument": instrument,
                    "source_locator": locator,
                    "reason": "locator did not resolve in the retrieved document",
                }
            )
            continue

        quote, dom_path = resolved
        passages.append(
            {
                "id": f"passage-{record['row_id'].lower()}",
                "row_id": record["row_id"],
                "document_version_id": f"dv-{source['document_id']}",
                "anchor_type": "html_dom",
                "dom_path": dom_path,
                "quote": quote,
                "anchor_hash": "sha256:" + hashlib.sha256(quote.encode("utf-8")).hexdigest(),
                "language": "en",
            }
        )

    out = root / OUT_DIR
    out.mkdir(parents=True, exist_ok=True)
    (out / "document-versions.json").write_bytes(canonical_json_bytes(document_versions))
    (out / "passages.json").write_bytes(canonical_json_bytes(passages))
    (out / "unresolved.json").write_bytes(canonical_json_bytes(unresolved))

    print(
        json.dumps(
            {
                "documents": len(document_versions),
                "rows": len(dataset["records"]),
                "passages": len(passages),
                "unresolved": len(unresolved),
                "unresolved_rows": [item["row_id"] for item in unresolved],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
