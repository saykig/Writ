"""Deterministic adapter for the Open US Law ``constitutions`` subset.

Acquisition is explicit and separate from rendering. Tests and normal imports read a frozen
newline-delimited JSON cache; only ``fetch_constitution_rows`` performs network access.
"""

from __future__ import annotations

import hashlib
import json
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DATASET_NAME = "vaquill/open-us-law"
DATASET_CONFIG = "constitutions"
DATASET_SPLIT = "train"
DATASET_SNAPSHOT = "v2026.07"
EXPECTED_JURISDICTIONS = frozenset(
    (
        "federal",
        "pr",
        "ak",
        "al",
        "ar",
        "az",
        "ca",
        "co",
        "ct",
        "de",
        "fl",
        "ga",
        "hi",
        "ia",
        "id",
        "il",
        "in",
        "ks",
        "ky",
        "la",
        "ma",
        "md",
        "me",
        "mi",
        "mn",
        "mo",
        "ms",
        "mt",
        "nc",
        "nd",
        "ne",
        "nh",
        "nj",
        "nm",
        "nv",
        "ny",
        "oh",
        "ok",
        "or",
        "pa",
        "ri",
        "sc",
        "sd",
        "tn",
        "tx",
        "ut",
        "va",
        "vt",
        "wa",
        "wi",
        "wv",
        "wy",
    )
)
REQUIRED_FIELDS = frozenset(
    {
        "act_id",
        "citation",
        "state",
        "jurisdiction",
        "document_type",
        "title_name",
        "chapter",
        "section_number",
        "section_title",
        "breadcrumb",
        "display_path",
        "act_status",
        "text",
        "source_url",
        "last_amended_year",
    }
)


class ConstitutionalImportError(RuntimeError):
    """Raised when source integrity, identity, or repository-size gates fail."""


@dataclass(frozen=True)
class ImportReport:
    record_count: int
    file_count: int
    generated_bytes: int
    jurisdictions: tuple[str, ...]
    federal_included: bool
    wrote_files: bool


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha256(value: str) -> str:
    return f"sha256:{hashlib.sha256(value.encode('utf-8')).hexdigest()}"


def row_hash(row: dict[str, Any]) -> str:
    return _sha256(_canonical_json(row))


def stable_record_id(row: dict[str, Any], snapshot: str = DATASET_SNAPSHOT) -> str:
    identity = "\x1f".join(
        str(value or "")
        for value in (
            DATASET_NAME,
            snapshot,
            row.get("state"),
            row.get("act_id"),
            row.get("section_number"),
        )
    )
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:24]
    state = re.sub(r"[^a-z0-9]+", "_", str(row.get("state") or "unknown").lower()).strip("_")
    return f"us_constitution_{state}_{digest}"


def fetch_constitution_rows(output: Path, *, page_size: int = 100) -> int:
    """Fetch only the dataset viewer's named constitutions subset to an untracked cache."""
    output.parent.mkdir(parents=True, exist_ok=True)
    offset = 0
    rows: list[dict[str, Any]] = []
    while True:
        query = urllib.parse.urlencode(
            {
                "dataset": DATASET_NAME,
                "config": DATASET_CONFIG,
                "split": DATASET_SPLIT,
                "offset": offset,
                "length": page_size,
            }
        )
        with urllib.request.urlopen(
            f"https://datasets-server.huggingface.co/rows?{query}", timeout=30
        ) as response:
            payload = json.load(response)
        page = [item["row"] for item in payload.get("rows", [])]
        rows.extend(page)
        offset += len(page)
        if not page or offset >= int(payload.get("num_rows_total", offset)):
            break
    output.write_text("".join(f"{_canonical_json(row)}\n" for row in rows), encoding="utf-8")
    return len(rows)


def load_constitution_rows(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        value = json.loads(line)
        if not isinstance(value, dict):
            raise ConstitutionalImportError(f"cache line {line_number} is not an object")
        missing = sorted(REQUIRED_FIELDS - value.keys())
        if missing:
            raise ConstitutionalImportError(f"cache line {line_number} missing fields: {missing}")
        if value["document_type"] != "constitution":
            raise ConstitutionalImportError(
                "non-constitutional row encountered; statutes are out of scope"
            )
        rows.append(value)
    return rows


def inspect_coverage(rows: Iterable[dict[str, Any]]) -> tuple[str, ...]:
    return tuple(sorted({str(row["state"]).lower() for row in rows}))


def deduplicate_rows(
    rows: Iterable[dict[str, Any]], snapshot: str = DATASET_SNAPSHOT
) -> list[dict[str, Any]]:
    by_id: dict[str, tuple[str, dict[str, Any]]] = {}
    for row in rows:
        record_id = stable_record_id(row, snapshot)
        digest = row_hash(row)
        existing = by_id.get(record_id)
        if existing is None:
            by_id[record_id] = (digest, row)
        elif existing[0] != digest:
            raise ConstitutionalImportError(f"identifier collision for {record_id}")
    return [by_id[key][1] for key in sorted(by_id)]


def _quoted(value: object) -> str:
    return json.dumps(str(value), ensure_ascii=False)


def _slug(value: object) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "root").lower()).strip("-")
    return slug or "root"


def _jurisdiction_level(state: str) -> str:
    if state == "federal":
        return "federal"
    if state == "dc":
        return "district"
    if state in {"pr", "gu", "vi", "as", "mp"}:
        return "territorial"
    return "state"


def _instrument_type(row: dict[str, Any]) -> str:
    citation = str(row.get("citation") or "").lower()
    breadcrumb = str(row.get("breadcrumb") or "").lower()
    return (
        "constitutional_amendment"
        if " const. amend." in citation or "amendment" in breadcrumb
        else "constitution"
    )


def _jurisdiction_name(row: dict[str, Any]) -> str:
    return str(row.get("title_name") or row["state"])


def render_record(row: dict[str, Any], *, snapshot: str = DATASET_SNAPSHOT) -> str:
    state = str(row["state"]).lower()
    record_id = stable_record_id(row, snapshot)
    text = str(row["text"])
    passage_hash = _sha256(text)
    digest = row_hash(row)
    source_id = f"open_us_law.{state}"
    document_version_id = f"open_us_law.{snapshot.replace('.', '_')}.{state}"
    passage_id = re.sub(r"[^A-Za-z0-9_-]+", "_", str(row["act_id"]))
    lines = [
        f"record {record_id} : legal_policy {{",
        "  corpus us.constitutional_law;",
        '  version "0.1.0";',
        f"  title {_quoted(row.get('section_title') or row['citation'])};",
        f"  subjects {{ jurisdiction_{state} }};",
        f"  assertion states {_quoted(text)};",
        "  topics {};",
        "  scope {",
        f"    jurisdiction {_quoted(_jurisdiction_name(row))};",
        "  }",
        "  evidence {",
        f"    support {source_id} document_version {document_version_id} passage {passage_id} locator {_quoted(row['citation'])} quote {_quoted(text)} passage_hash {_quoted(passage_hash)} document_hash {_quoted(digest)} basis direct;",
        "  }",
        "  uncertainty {",
        '    item unknown "Legal force, applicability, and enforcement are not inferred during import.";',
        "  }",
        "  provenance {",
        '    created_by "Writ Open US Law constitutional importer";',
        "    created_at 2026-08-03;",
        "  }",
        "  review_state draft;",
        "  legal_policy {",
        f"    instrument_type {_instrument_type(row)};",
        f"    jurisdiction_level {_jurisdiction_level(state)};",
        "    force unknown;",
        "    adoption_status unknown;",
        "    applicability_status unknown;",
        "    enforcement_status unknown;",
        f"    official_citation {_quoted(row['citation'])};",
        f"    provision_identifier {_quoted(row['act_id'])};",
        f"    jurisdictions {{ {_quoted(_jurisdiction_name(row))} }};",
        "    source_metadata {",
        f"      dataset_name {_quoted(DATASET_NAME)};",
        f"      dataset_snapshot {_quoted(snapshot)};",
        f"      source_row_identifier {_quoted(row['act_id'])};",
        f"      jurisdiction {_quoted(state)};",
        f"      title {_quoted(row['title_name'])};",
    ]
    if row.get("source_url") is not None:
        lines.insert(-2, f"      source_url {_quoted(row['source_url'])};")
    if row.get("chapter") is not None:
        lines.append(f"      chapter {_quoted(row['chapter'])};")
    if row.get("section_number") is not None:
        lines.append(f"      section_number {_quoted(row['section_number'])};")
    if row.get("section_title") is not None:
        lines.append(f"      section_title {_quoted(row['section_title'])};")
    lines.extend(
        [
            f"      original_text {_quoted(text)};",
        ]
    )
    if row.get("last_amended_year") is not None:
        lines.append(f"      last_amended_year {int(row['last_amended_year'])};")
    lines.extend(
        [
            f"      row_hash {_quoted(digest)};",
            "    }",
            "  }",
            "}",
        ]
    )
    return "\n".join(lines)


def relative_output_path(row: dict[str, Any]) -> Path:
    state = str(row["state"]).lower()
    breadcrumb = row.get("breadcrumb")
    try:
        parts = json.loads(breadcrumb) if isinstance(breadcrumb, str) else breadcrumb
    except json.JSONDecodeError:
        parts = []
    structure = parts[1] if isinstance(parts, list) and len(parts) > 1 else row.get("display_path")
    name = f"{_slug(structure)}.writ"
    if state == "federal":
        return Path("federal") / name
    if state == "dc":
        return Path("district-of-columbia") / name
    if state in {"pr", "gu", "vi", "as", "mp"}:
        return Path("territories") / state / name
    return Path("states") / state / name


def build_documents(
    rows: Iterable[dict[str, Any]], *, snapshot: str = DATASET_SNAPSHOT
) -> dict[Path, str]:
    grouped: dict[Path, list[str]] = defaultdict(list)
    for row in deduplicate_rows(rows, snapshot):
        grouped[relative_output_path(row)].append(render_record(row, snapshot=snapshot))
    header = 'language writ "0.1"\npackage us.constitutional_law version "0.1.0";\n\n'
    return {path: header + "\n\n".join(records) + "\n" for path, records in sorted(grouped.items())}


def import_constitutions(
    rows: Iterable[dict[str, Any]],
    output_dir: Path,
    *,
    dry_run: bool = False,
    sample: int | None = None,
    max_bytes: int = 10 * 1024 * 1024,
    snapshot: str = DATASET_SNAPSHOT,
) -> ImportReport:
    selected = deduplicate_rows(rows, snapshot)
    if sample is not None:
        selected = selected[:sample]
    documents = build_documents(selected, snapshot=snapshot)
    generated_bytes = sum(len(content.encode("utf-8")) for content in documents.values())
    if generated_bytes > max_bytes:
        raise ConstitutionalImportError(
            f"projected generated corpus is {generated_bytes} bytes, above the {max_bytes}-byte gate"
        )
    if not dry_run:
        for relative, content in documents.items():
            target = output_dir / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
    jurisdictions = inspect_coverage(selected)
    return ImportReport(
        record_count=len(selected),
        file_count=len(documents),
        generated_bytes=generated_bytes,
        jurisdictions=jurisdictions,
        federal_included="federal" in jurisdictions,
        wrote_files=not dry_run,
    )
