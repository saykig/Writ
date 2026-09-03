from __future__ import annotations

import hashlib
import json
import os
import subprocess
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

import pytest

from .ecfr import PROFILE, EcfrParagraphSelector, Transformation, ground_ecfr

ROOT = Path(__file__).resolve().parents[3]
NIST = ROOT / "corpora/institutional/us/nist"
SELECTOR = EcfrParagraphSelector(15, "285", "285.9", "a")


def digest(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


@pytest.fixture(scope="module")
def retained():
    # Test-only oracle: reuse existing Writ parsing and source routing, not Experiment A machinery.
    script = """
      import { loadRepository } from './internal/verification/writ/src/repository.ts';
      import { resolveRoutedSource } from './internal/verification/writ/src/core/sources.ts';
      const { snapshot: s } = loadRepository(process.cwd());
      if (s.loadIssues.length) throw new Error(JSON.stringify(s.loadIssues));
      const id = 'ecfr.title15_cfr_part_285';
      const source = resolveRoutedSource(s, 'us.institutions.nist', id);
      if (source.status !== 'resolved') throw new Error(source.status);
      const evidence = s.records.filter(r => r.corpus_id === 'us.institutions.nist'
        && r.value.review_state === 'approved').flatMap(r => r.value.evidence)
        .filter(e => e.source_id === id);
      console.log(JSON.stringify({ source: source.source.value, evidence }));
    """
    result = subprocess.run(
        [os.environ.get("BUN", "bun"), "-e", script],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    inputs = json.loads(result.stdout)
    source = inputs["source"]
    content = (NIST / "sources/captures/ecfr-15-cfr-part-285.xml").read_bytes()
    manifest = dict(
        line.split(maxsplit=1)[::-1]
        for line in (NIST / "sources/MANIFEST.sha256").read_text().splitlines()
    )
    assert (
        source["document_hash"]
        == "sha256:" + manifest["captures/ecfr-15-cfr-part-285.xml"]
    )
    assert all(
        ref["document_hash"] == source["document_hash"]
        and ref["document_version_id"] == source["document_version_id"]
        for ref in inputs["evidence"]
    )
    return (
        content,
        {
            key: source[key]
            for key in (
                "source_id",
                "document_version_id",
                "document_hash",
                "media_type",
            )
        },
        inputs["evidence"],
    )


@pytest.mark.parametrize("subsection", ["a", "d"])
def test_retained_passage_is_grounded_without_quote_input(retained, subsection):
    content, identity, oracles = retained
    selector = replace(SELECTOR, subsection=subsection)
    result = ground_ecfr(
        content, **identity, selector=selector, extraction_profile=PROFILE
    )
    assert result.status == "GROUNDED"
    assert result.document_hash == digest(content) == identity["document_hash"]
    assert result.source_id == identity["source_id"]
    assert result.document_version_id == identity["document_version_id"]
    assert result.selector == selector and result.extraction_profile == PROFILE
    assert result.candidate_count == 1
    assert (
        result.selected_element == f"/DIV5/DIV8[9]/P[{1 if subsection == 'a' else 4}]"
    )
    assert result.transformations == (
        Transformation("remove_exact_prefix", f"({subsection}) "),
    )
    assert result.raw_extracted_text == f"({subsection}) " + result.evidence_text
    # Only now consult the reviewed quotation and passage hash.
    oracle = next(
        ref for ref in oracles if ref["locator"] == f"15 CFR § 285.9({subsection})"
    )
    assert result.evidence_utf8 == oracle["quote"].encode("utf-8")
    assert result.passage_hash == oracle["passage_hash"] == digest(result.evidence_utf8)
    changed_oracle = {**oracle, "quote": "Changed after extraction"}
    assert changed_oracle["quote"] != result.evidence_text
    for _ in range(3):
        assert (
            ground_ecfr(
                content, **identity, selector=selector, extraction_profile=PROFILE
            )
            == result
        )


@pytest.mark.parametrize(
    "selector,status",
    [
        (replace(SELECTOR, subsection="e"), "NOT_FOUND"),
        (replace(SELECTOR, section="285.99"), "NOT_FOUND"),
        (EcfrParagraphSelector(15, "286", "286.9", "a"), "NOT_FOUND"),
        (replace(SELECTOR, title=16), "SECTION_METADATA_MISMATCH"),
    ],
)
def test_wrong_selector_never_returns_neighboring_text(retained, selector, status):
    content, identity, _ = retained
    result = ground_ecfr(
        content, **identity, selector=selector, extraction_profile=PROFILE
    )
    assert result.status == status
    assert result.raw_extracted_text is None
    assert result.evidence_utf8 is None and result.passage_hash is None


@pytest.mark.parametrize(
    "change,status",
    [
        ({"document": b"changed frozen bytes"}, "DOCUMENT_HASH_MISMATCH"),
        ({"document_hash": "sha256:" + "0" * 64}, "DOCUMENT_HASH_MISMATCH"),
        ({"source_id": ""}, "INVALID_IDENTITY"),
        ({"document_version_id": " "}, "INVALID_IDENTITY"),
        ({"media_type": "application/pdf"}, "UNSUPPORTED_MEDIA_TYPE"),
        ({"extraction_profile": "unknown-profile"}, "UNSUPPORTED_PROFILE"),
        ({"selector": replace(SELECTOR, subsection="a(1)")}, "UNSUPPORTED_SELECTOR"),
    ],
)
def test_identity_and_explicit_contract_are_checked_before_parsing(
    retained, change, status
):
    content, identity, _ = retained
    arguments = {
        "document": content,
        **identity,
        "selector": SELECTOR,
        "extraction_profile": PROFILE,
        **change,
    }
    with patch(
        ground_ecfr.__module__ + ".ET.fromstring",
        side_effect=AssertionError("parser called"),
    ):
        result = ground_ecfr(**arguments)
    assert result.status == status
    assert result.candidate_count == 0 and result.selected_element is None
    assert result.raw_extracted_text is None and result.transformations == ()
    assert result.evidence_text is None and result.passage_hash is None
    if status in {"DOCUMENT_HASH_MISMATCH", "INVALID_IDENTITY"}:
        assert result.document_hash is None


def synthetic(
    paragraphs: str, *, sections: int = 1, citation: str = "15 CFR 285.9"
) -> bytes:
    # Isolated structural fixtures, never written to the retained corpus or its capture.
    section = (
        '<DIV8 TYPE="SECTION" N="285.9" hierarchy_metadata=\''
        + json.dumps({"citation": citation})
        + "'>"
        + paragraphs
        + "</DIV8>"
    )
    return ('<DIV5 TYPE="PART" N="285">' + section * sections + "</DIV5>").encode()


def from_fixture(content: bytes):
    return ground_ecfr(
        content,
        source_id="test.ecfr",
        document_version_id="test.ecfr.v1",
        document_hash=digest(content),
        media_type="application/xml",
        selector=SELECTOR,
        extraction_profile=PROFILE,
    )


@pytest.mark.parametrize(
    "content,paths",
    [
        (
            synthetic("<P>(a) Identical.</P><P>(a) Identical.</P>"),
            ("/DIV5/DIV8[1]/P[1]", "/DIV5/DIV8[1]/P[2]"),
        ),
        (
            synthetic("<P>(a) Identical.</P>", sections=2),
            ("/DIV5/DIV8[1]", "/DIV5/DIV8[2]"),
        ),
    ],
)
def test_duplicate_structural_matches_are_ambiguous_even_with_identical_text(
    content, paths
):
    result = from_fixture(content)
    assert result.status == "AMBIGUOUS" and result.candidate_count == 2
    assert result.candidate_elements == paths
    assert result.selected_element is None and result.raw_extracted_text is None
    assert result.evidence_utf8 is None and result.passage_hash is None
    assert result.transformations == ()


def test_profile_preserves_text_nodes_entities_and_whitespace():
    result = from_fixture(synthetic("<P>(a) A <I>word</I> &amp;\n  another. </P>"))
    assert result.raw_extracted_text == "(a) A word &\n  another. "
    assert result.evidence_utf8 == b"A word &\n  another. "
    assert result.passage_hash == digest(result.evidence_utf8)


@pytest.mark.parametrize(
    "content,status",
    [
        (b"<invalid", "INVALID_XML"),
        (
            synthetic("<P>(a) Text.</P>", citation="16 CFR 285.9"),
            "SECTION_METADATA_MISMATCH",
        ),
        (
            synthetic("<P>(a) Text.</P>").replace(
                b'{"citation": "15 CFR 285.9"}', b"null"
            ),
            "SECTION_METADATA_MISMATCH",
        ),
        (
            synthetic("<P>(a) Text.</P>").replace(
                b'{"citation": "15 CFR 285.9"}', b"invalid"
            ),
            "SECTION_METADATA_MISMATCH",
        ),
        (synthetic("<P>(a)\tText.</P>"), "TRANSFORMATION_MISMATCH"),
    ],
)
def test_invalid_structure_or_profile_does_not_create_evidence(content, status):
    result = from_fixture(content)
    assert result.status == status
    assert result.evidence_text is None and result.passage_hash is None
    assert result.transformations == ()
    if status == "TRANSFORMATION_MISMATCH":
        assert result.raw_extracted_text == "(a)\tText."
        assert result.selected_element == "/DIV5/DIV8[1]/P[1]"
