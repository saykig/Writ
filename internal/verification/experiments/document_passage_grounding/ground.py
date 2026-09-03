"""Experiment A only: no Writ imports, quotation input, I/O, or acceptance semantics."""

from __future__ import annotations

import hashlib
import json
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Literal


def sha256(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def text_hash(text: str) -> str:
    return sha256(text.encode("utf-8"))


@dataclass(frozen=True)
class FrozenDocument:
    content: bytes
    source_id: str
    document_version_id: str
    # Authority comes from the caller; none of these declarations is a quote or passage hash.
    declared_hashes: tuple[tuple[str, str], ...]
    evidence_versions: tuple[str, ...]


@dataclass(frozen=True)
class Step:
    transformation: str
    text: str
    passage_hash: str


def step(transformation: str, text: str) -> Step:
    return Step(transformation, text, text_hash(text))


@dataclass(frozen=True)
class Candidate:
    selection: str
    pages: tuple[int, ...]
    raw_text: str
    raw_passage_hash: str
    steps: tuple[Step, ...]


Status = Literal[
    "resolved",
    "no_candidate",
    "ambiguous",
    "source_capture_mismatch",
    "unsupported_locator",
    "extraction_error",
]


@dataclass(frozen=True)
class Grounding:
    source_id: str
    document_version_id: str
    document_hash: str
    declared_hashes: tuple[tuple[str, str], ...]
    identity_verified: bool
    media_type: str
    locator: str
    status: Status
    diagnostic: str
    engine: str | None
    extraction_profile: str | None
    candidate_count: int
    candidates: tuple[Candidate, ...]
    extracted_passage: str | None
    passage_hash: str | None


def xml_candidates(content: bytes, locator: str) -> tuple[Candidate, ...] | None:
    """One deliberately bounded grammar, not a universal locator ontology."""
    match = re.fullmatch(r"(\d+) CFR § (\d+\.\d+)\(([a-z])\)", locator)
    if not match:
        return None
    title, section_id, paragraph = match.groups()
    root = ET.fromstring(content)
    marker = f"({paragraph}) "
    candidates = []
    for section in root.findall(f"./DIV8[@TYPE='SECTION'][@N='{section_id}']"):
        metadata = json.loads(section.get("hierarchy_metadata", "{}"))
        if metadata.get("citation") != f"{title} CFR {section_id}":
            continue
        for index, element in enumerate(section.findall("./P"), 1):
            # XML parsing decodes entities; itertext preserves all text nodes, in order.
            raw = "".join(element.itertext())
            if raw.startswith(marker):
                candidates.append(
                    Candidate(
                        selection=f"/DIV5[@N='{root.get('N')}']/DIV8[@N='{section_id}']/P[{index}]",
                        pages=(),
                        raw_text=raw,
                        raw_passage_hash=text_hash(raw),
                        steps=(
                            step(
                                f"Remove exact locator marker {marker!r}; retain all other text",
                                raw[len(marker) :],
                            ),
                        ),
                    )
                )
    return tuple(candidates)


# Includes contents entries and line-initial cross-references. No unrecorded heading heuristic.
PDF_MARKER = re.compile(r"^(\d+(?:\.\d+)+)[ \t]+", re.MULTILINE)


def pdf_candidates(
    content: bytes, locator: str
) -> tuple[tuple[Candidate, ...] | None, str]:
    import fitz  # Existing apps/ingest dependency. Imported only after identity verification.

    engine = f"PyMuPDF {fitz.VersionBind}; MuPDF {fitz.VersionFitz}; get_text(text, sort=False)"
    match = re.fullmatch(r"NIST Handbook 150:2020, clause (\d+(?:\.\d+)+)", locator)
    if not match:
        return None, engine
    clause = match[1]
    with fitz.open(stream=content, filetype="pdf") as document:
        pages = [page.get_text("text", sort=False) for page in document]
    # Form feeds are explicit page separators, never removed by the whitespace step below.
    text = "\f".join(pages)
    page_starts = [0]
    for page in pages[:-1]:
        page_starts.append(page_starts[-1] + len(page) + 1)
    markers = list(PDF_MARKER.finditer(text))
    candidates = []
    for index, marker in enumerate(markers):
        if marker[1] != clause:
            continue
        # Include subordinate clauses. Stop at the next non-descendant numeric marker.
        end = next(
            (
                other.start()
                for other in markers[index + 1 :]
                if not other[1].startswith(clause + ".")
            ),
            len(text),
        )
        raw = text[marker.start() : end]
        body = text[marker.end() : end]
        covered = tuple(
            i + 1
            for i, start in enumerate(page_starts)
            if start < end and start + len(pages[i]) > marker.start()
        )
        candidates.append(
            Candidate(
                selection=f"numeric marker {clause}; character interval [{marker.start()}, {end})",
                pages=covered,
                raw_text=raw,
                raw_passage_hash=text_hash(raw),
                steps=(
                    step(
                        "Remove numeric locator marker and its following spaces/tabs",
                        body,
                    ),
                    step(
                        "Replace runs of ASCII space/tab/CR/LF with one space; trim edge spaces; "
                        "retain form feeds, headers, footers, punctuation, and hyphens",
                        re.sub(r"[ \t\r\n]+", " ", body).strip(" "),
                    ),
                ),
            )
        )
    return tuple(candidates), engine


def ground(document: FrozenDocument, media_type: str, locator: str) -> Grounding:
    """Extract independently from bytes + media type + locator, after declared identity checks."""
    actual = sha256(document.content)
    verified = (
        bool(document.declared_hashes)
        and all(declared == actual for _, declared in document.declared_hashes)
        and all(
            version == document.document_version_id
            for version in document.evidence_versions
        )
    )
    engine = None
    profile = None
    candidates: tuple[Candidate, ...] = ()
    status: Status = "source_capture_mismatch"
    diagnostic = "DPG_SOURCE_CAPTURE_MISMATCH"
    if verified:
        try:
            if media_type == "application/xml":
                engine = "Python stdlib ElementTree; itertext in document order"
                profile = "ecfr-subsection-marker-v1"
                found = xml_candidates(document.content, locator)
            elif media_type == "application/pdf":
                profile = "handbook-numeric-clause-ascii-whitespace-v1"
                found, engine = pdf_candidates(document.content, locator)
            else:
                found = None
            if found is None:
                status, diagnostic = "unsupported_locator", "DPG_UNSUPPORTED_LOCATOR"
            else:
                candidates = found
                status, diagnostic = (
                    ("no_candidate", "DPG_NO_CANDIDATE")
                    if not candidates
                    else ("resolved", "DPG_ONE_CANDIDATE")
                    if len(candidates) == 1
                    else ("ambiguous", "DPG_AMBIGUOUS")
                )
        except (ET.ParseError, ValueError, RuntimeError) as error:
            status, diagnostic = (
                "extraction_error",
                f"DPG_EXTRACTION_ERROR:{type(error).__name__}",
            )
    selected = candidates[0].steps[-1] if status == "resolved" else None
    return Grounding(
        source_id=document.source_id,
        document_version_id=document.document_version_id,
        document_hash=actual,
        declared_hashes=document.declared_hashes,
        identity_verified=verified,
        media_type=media_type,
        locator=locator,
        status=status,
        diagnostic=diagnostic,
        engine=engine,
        extraction_profile=profile,
        candidate_count=len(candidates),
        candidates=candidates,
        extracted_passage=selected.text if selected else None,
        passage_hash=selected.passage_hash if selected else None,
    )
