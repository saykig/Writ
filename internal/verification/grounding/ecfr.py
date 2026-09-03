"""Pure, bounded eCFR XML paragraph grounding. Caller supplies identity authority."""

from __future__ import annotations

import hashlib
import json
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Literal

PROFILE = "ecfr-paragraph-remove-marker-v1"


@dataclass(frozen=True)
class EcfrParagraphSelector:
    title: int
    part: str
    section: str
    subsection: str


@dataclass(frozen=True)
class Transformation:
    operation: Literal["remove_exact_prefix"]
    prefix: str


Status = Literal[
    "GROUNDED",
    "INVALID_IDENTITY",
    "DOCUMENT_HASH_MISMATCH",
    "UNSUPPORTED_MEDIA_TYPE",
    "UNSUPPORTED_PROFILE",
    "UNSUPPORTED_SELECTOR",
    "INVALID_XML",
    "NOT_FOUND",
    "AMBIGUOUS",
    "SECTION_METADATA_MISMATCH",
    "TRANSFORMATION_MISMATCH",
]


@dataclass(frozen=True)
class GroundingResult:
    source_id: str
    document_version_id: str
    declared_document_hash: str
    # Verified hash only; absent when declared identity fails.
    document_hash: str | None
    observed_document_hash: str
    media_type: str
    selector: EcfrParagraphSelector
    extraction_profile: str
    status: Status
    candidate_elements: tuple[str, ...]
    selected_element: str | None
    raw_extracted_text: str | None
    transformations: tuple[Transformation, ...]
    evidence_text: str | None
    passage_hash: str | None

    @property
    def candidate_count(self) -> int:
        return len(self.candidate_elements)

    @property
    def evidence_bytes(self) -> bytes | None:
        return (
            self.evidence_text.encode("utf-8")
            if self.evidence_text is not None
            else None
        )


def _sha256(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def ground_ecfr(
    document: bytes,
    *,
    source_id: str,
    document_version_id: str,
    document_hash: str,
    media_type: str,
    selector: EcfrParagraphSelector,
    extraction_profile: str,
) -> GroundingResult:
    """Select one complete direct P element; never accept a quotation or free-form locator."""
    observed = _sha256(document)
    identity_valid = bool(source_id.strip() and document_version_id.strip())
    verified = observed if identity_valid and observed == document_hash else None

    def finish(
        status: Status,
        candidates: tuple[str, ...] = (),
        *,
        raw: str | None = None,
        transformations: tuple[Transformation, ...] = (),
        evidence: str | None = None,
    ) -> GroundingResult:
        return GroundingResult(
            source_id=source_id,
            document_version_id=document_version_id,
            declared_document_hash=document_hash,
            document_hash=verified,
            observed_document_hash=observed,
            media_type=media_type,
            selector=selector,
            extraction_profile=extraction_profile,
            status=status,
            candidate_elements=candidates,
            selected_element=candidates[0]
            if len(candidates) == 1 and raw is not None
            else None,
            raw_extracted_text=raw,
            transformations=transformations,
            evidence_text=evidence,
            passage_hash=_sha256(evidence.encode("utf-8"))
            if evidence is not None
            else None,
        )

    # All checks precede parsing; a hash failure cannot expose even a candidate passage.
    if not identity_valid:
        return finish("INVALID_IDENTITY")
    if verified is None:
        return finish("DOCUMENT_HASH_MISMATCH")
    if media_type != "application/xml":
        return finish("UNSUPPORTED_MEDIA_TYPE")
    if extraction_profile != PROFILE:
        return finish("UNSUPPORTED_PROFILE")
    if not (
        type(selector.title) is int
        and selector.title > 0
        and re.fullmatch(r"[0-9]+", selector.part)
        and re.fullmatch(re.escape(selector.part) + r"\.[0-9]+", selector.section)
        and re.fullmatch(r"[a-z]", selector.subsection)
    ):
        return finish("UNSUPPORTED_SELECTOR")
    try:
        root = ET.fromstring(document)
    except ET.ParseError:
        return finish("INVALID_XML")
    if (
        root.tag != "DIV5"
        or root.get("TYPE") != "PART"
        or root.get("N") != selector.part
    ):
        return finish("NOT_FOUND")
    sections = [
        (f"/DIV5/DIV8[{index}]", element)
        for index, element in enumerate(root.findall("./DIV8"), 1)
        if element.get("TYPE") == "SECTION" and element.get("N") == selector.section
    ]
    paths = tuple(path for path, _ in sections)
    if not sections:
        return finish("NOT_FOUND")
    if len(sections) != 1:
        return finish("AMBIGUOUS", paths)
    section_path, section = sections[0]
    try:
        metadata = json.loads(section.get("hierarchy_metadata", "{}"))
    except ValueError:
        metadata = None
    if not isinstance(metadata, dict) or metadata.get("citation") != (
        f"{selector.title} CFR {selector.section}"
    ):
        return finish("SECTION_METADATA_MISMATCH", paths)
    marker = f"({selector.subsection})"
    paragraphs = [
        (f"{section_path}/P[{index}]", "".join(element.itertext()))
        for index, element in enumerate(section.findall("./P"), 1)
    ]
    matches = [(path, raw) for path, raw in paragraphs if raw.startswith(marker)]
    paths = tuple(path for path, _ in matches)
    if not matches:
        return finish("NOT_FOUND")
    if len(matches) != 1:
        return finish("AMBIGUOUS", paths)
    _, raw = matches[0]
    prefix = marker + " "
    if not raw.startswith(prefix):
        return finish("TRANSFORMATION_MISMATCH", paths, raw=raw)
    return finish(
        "GROUNDED",
        paths,
        raw=raw,
        transformations=(Transformation("remove_exact_prefix", prefix),),
        evidence=raw[len(prefix) :],
    )
