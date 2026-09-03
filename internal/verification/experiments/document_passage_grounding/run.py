"""Offline experiment runner. The oracle is compared only after all extraction runs finish."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from dataclasses import asdict, replace
from pathlib import Path

from .ground import FrozenDocument, Grounding, ground, sha256, text_hash

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
SOURCE_ROOT = ROOT / "corpora/institutional/us/nist/sources"
REPORT = ROOT / "docs/verification/document-passage-grounding-results.json"


def load_inputs() -> dict:
    # Reuse Writ's parser and manifest-routed source adapter instead of parsing Writ with regexes.
    output = subprocess.run(
        [os.environ.get("BUN", "bun"), str(HERE / "oracle.ts")],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(output.stdout)


def documents(inputs: dict) -> dict[str, FrozenDocument]:
    manifest = dict(
        line.split(maxsplit=1)[::-1]
        for line in (SOURCE_ROOT / "MANIFEST.sha256").read_text().splitlines()
    )
    result = {}
    for source in inputs["sources"]:
        refs = [
            item
            for item in inputs["evidence"]
            if item["source_id"] == source["source_id"]
        ]
        capture = "captures/" + source["capture"]
        claims = [
            ("sources.writ", source["document_hash"]),
            ("sources/MANIFEST.sha256", "sha256:" + manifest[capture]),
        ]
        claims.extend(
            (item["passage_id"] + ":document_hash", item["document_hash"])
            for item in refs
        )
        result[source["source_id"]] = FrozenDocument(
            content=(SOURCE_ROOT / capture).read_bytes(),
            source_id=source["source_id"],
            document_version_id=source["document_version_id"],
            declared_hashes=tuple(claims),
            evidence_versions=tuple(item["document_version_id"] for item in refs),
        )
    return result


def unresolved_classification(result: Grounding, reproducible: bool = True) -> str:
    if not result.identity_verified:
        return "SOURCE_CAPTURE_MISMATCH"
    if not reproducible:
        return "NOT_REPRODUCIBLE"
    return "LOCATOR_CONTRACT_INSUFFICIENT"


def compare(result: Grounding, oracle: dict, reproducible: bool = True) -> dict:
    """Post-extraction byte comparison only; never feeds information back to a resolver."""
    quote = oracle["quote"]
    stored_hash = oracle["passage_hash"]
    raw = result.candidates[0].raw_text if result.status == "resolved" else None
    extracted = result.extracted_passage
    exact = extracted is not None and extracted.encode("utf-8") == quote.encode("utf-8")
    raw_exact = raw is not None and raw.encode("utf-8") == quote.encode("utf-8")
    raw_hash_equal = raw is not None and text_hash(raw) == stored_hash
    hash_equal = result.passage_hash == stored_hash
    classification = unresolved_classification(result, reproducible)
    if result.identity_verified and reproducible and raw_exact and raw_hash_equal:
        classification = "EXACT_GROUNDING_CONFIRMED"
    elif result.identity_verified and reproducible and exact and hash_equal:
        classification = "DETERMINISTIC_EXTRACTION_PROFILE_REQUIRED"
    first_difference = None
    if extracted is not None and not exact:
        left, right = extracted.encode("utf-8"), quote.encode("utf-8")
        first_difference = next(
            (i for i, (a, b) in enumerate(zip(left, right)) if a != b),
            min(len(left), len(right)),
        )
    return {
        "classification": classification,
        "stored_quote": quote,
        "stored_passage_hash": stored_hash,
        "stored_quote_self_hash_matches": text_hash(quote) == stored_hash,
        "raw_utf8_equals_stored_quote": raw_exact,
        "raw_hash_equals_stored_hash": raw_hash_equal,
        "profiled_utf8_equals_stored_quote": exact,
        "profiled_hash_equals_stored_hash": hash_equal,
        "first_differing_utf8_byte": first_difference,
        "stored_quote_is_proper_prefix_of_profiled_passage": (
            extracted is not None and extracted.startswith(quote) and not exact
        ),
    }


def make_report(inputs: dict) -> dict:
    docs = documents(inputs)
    media = {source["source_id"]: source["media_type"] for source in inputs["sources"]}
    # Build locator-only requests. No expected quotation or passage hash crosses this boundary.
    requests = [
        (
            ref["passage_id"],
            docs[ref["source_id"]],
            media[ref["source_id"]],
            ref["locator"],
        )
        for ref in inputs["evidence"]
    ]
    # Finish ALL extractions and repetitions before comparing any reviewed oracle.
    runs = {
        pid: [ground(doc, kind, locator) for _ in range(3)]
        for pid, doc, kind, locator in requests
    }
    cases = []
    for oracle in inputs["evidence"]:
        repeated = runs[oracle["passage_id"]]
        stable = all(result == repeated[0] for result in repeated)
        result = repeated[0]
        comparison = compare(result, oracle, stable)
        altered = {**oracle, "quote": oracle["quote"] + " [altered after extraction]"}
        before = asdict(result)
        altered_comparison = compare(result, altered, stable)
        cases.append(
            {
                "passage_id": oracle["passage_id"],
                "grounding": before,
                "comparison": comparison,
                "repeat_count": len(repeated),
                "repeated_results_identical": stable,
                "altered_oracle_control": {
                    "grounding_unchanged": before == asdict(result),
                    "comparison": altered_comparison,
                },
            }
        )
    controls = []
    xml, pdf = "ecfr.title15_cfr_part_285", "nist.handbook_150"
    for name, source, locator in [
        ("xml_nonexistent_neighbor", xml, "15 CFR § 285.9(e)"),
        ("pdf_nonexistent_neighbor", pdf, "NIST Handbook 150:2020, clause 1.3.99"),
        ("pdf_contents_body_ambiguity", pdf, "NIST Handbook 150:2020, clause 3.5"),
        ("pdf_cross_page_probe", pdf, "NIST Handbook 150:2020, clause 1.3.2"),
        (
            "pdf_hyphenation_and_ambiguity_probe",
            pdf,
            "NIST Handbook 150:2020, clause 1.12",
        ),
    ]:
        repeated = [ground(docs[source], media[source], locator) for _ in range(3)]
        stable = len(set(repeated)) == 1
        controls.append(
            {
                "case": name,
                "grounding": asdict(repeated[0]),
                "classification": unresolved_classification(repeated[0], stable),
                "classification_scope": "Modified locator probe; no reviewed quote/hash oracle. "
                "This is not a claim that valid absence is a resolver defect.",
                "stored_quote": None,
                "stored_passage_hash": None,
                "repeat_count": 3,
                "repeated_results_identical": stable,
            }
        )
    for source, locator in [
        (xml, "15 CFR § 285.9(a)"),
        (pdf, "NIST Handbook 150:2020, clause 1.3.5"),
    ]:
        original = docs[source]
        altered = replace(original, content=b"!" + original.content[1:])
        result = ground(altered, media[source], locator)
        controls.append(
            {
                "case": source + ":altered_document_bytes",
                "mutation": "Replace byte zero with ASCII !; retain all declared hashes and versions",
                "original_document_hash": sha256(original.content),
                "classification": unresolved_classification(result),
                "grounding": asdict(result),
            }
        )
    classifications = {case["comparison"]["classification"] for case in cases}
    if classifications & {"SOURCE_CAPTURE_MISMATCH", "NOT_REPRODUCIBLE"}:
        conclusion = "DOCUMENT_PASSAGE_GROUNDING_FALSIFIED"
    elif "LOCATOR_CONTRACT_INSUFFICIENT" in classifications:
        conclusion = "CURRENT_LOCATOR_MODEL_INSUFFICIENT"
    elif "DETERMINISTIC_EXTRACTION_PROFILE_REQUIRED" in classifications:
        conclusion = "DOCUMENT_PASSAGE_GROUNDING_CONFIRMED_WITH_EXPLICIT_PROFILES"
    else:
        conclusion = "DOCUMENT_PASSAGE_GROUNDING_CONFIRMED"
    return {
        "experiment": "A",
        "baseline": "7c1ff7cf881236beacb40181a83f320e88d9b4f1",
        "overall_conclusion": conclusion,
        "sources": inputs["sources"],
        "reviewed_cases": cases,
        "controls": controls,
        "promotion": "Keep both resolvers internal. XML merits a bounded follow-up; PDF needs "
        "explicit passage extent and an extraction contract. No public primitive promoted.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="Compare the tracked report; write nothing"
    )
    args = parser.parse_args()
    report = json.dumps(make_report(load_inputs()), ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if report != REPORT.read_text(encoding="utf-8"):
            raise SystemExit(
                "Experiment output differs (including extraction engine/version); inspect drift"
            )
        print("Experiment A report reproduced byte-for-byte")
    else:
        print(report, end="")


if __name__ == "__main__":
    main()
