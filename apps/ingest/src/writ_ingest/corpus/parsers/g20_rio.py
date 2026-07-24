"""Parser for the G20 Research Group 2024 Rio compliance report PDFs.

This keeps the Rio raw layout out of the shared corpus code (per the adapter
contract). It extracts only what the document prints -- the selected-commitment
table (Table 1) and the member x commitment score matrix (Table 2) -- and never
infers a score, a date, or a commitment. Blank or unreadable score cells are left
for the shared ``extract_member_assessment_row`` primitive to quarantine.
"""

from __future__ import annotations

import contextlib
import io
import re
from dataclasses import dataclass
from typing import Any

import fitz  # type: ignore[import-untyped]

_MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

_DATE = r"\d{1,2}\s+[A-Za-z]+\s+\d{4}"
_DATE_RANGE = re.compile(rf"({_DATE})\s+to\s+({_DATE})")
_MONITORING = re.compile(rf"actions taken from\s+({_DATE})\s+to\s+({_DATE})")
# Each selected commitment ends with its G20 Research Group id, e.g. "(2024-122)".
_COMMITMENT_ID = re.compile(r"\(2024-(\d+)\)")
# The order number precedes the text either on its own line ("1\nWe...") or inline
# ("12 We..."), so accept any whitespace between the number and the commitment text.
_ORDER = re.compile(r"\s*(\d{1,2})\s+(.*)", re.DOTALL)


@dataclass(frozen=True)
class RioCommitment:
    """One selected commitment as printed in Table 1."""

    order: int
    commitment_id: str  # e.g. "2024-122"
    exact_text: str


@dataclass(frozen=True)
class RioScoreCell:
    """One member x commitment score cell as printed in Table 2."""

    commitment_order: int
    member: str  # printed member name, whitespace-normalized
    raw_score: str  # normalized token: "+1", "0", "-1", "not_applicable", or ""


@dataclass(frozen=True)
class RioExtraction:
    """Everything one Rio compliance report yields, with provenance-free anchors."""

    stage: str  # "interim" | "final"
    publication_date: str | None
    monitoring_window_start: str | None
    monitoring_window_end: str | None
    cover_window_start: str | None
    cover_window_end: str | None
    members: tuple[str, ...]
    commitments: tuple[RioCommitment, ...]
    scores: tuple[RioScoreCell, ...]
    warnings: tuple[str, ...]


def _norm_ws(value: Any) -> str:
    return " ".join(str(value or "").split())


def _iso_date(phrase: str | None) -> str | None:
    if not phrase:
        return None
    match = re.match(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", phrase.strip())
    if match is None:
        return None
    day, month_name, year = match.groups()
    month = _MONTHS.get(month_name.lower())
    if month is None:
        return None
    return f"{int(year):04d}-{month:02d}-{int(day):02d}"


def _open(payload: bytes) -> Any:
    return fitz.open(stream=payload, filetype="pdf")


def _find_tables(page: Any) -> Any:
    # find_tables prints an advisory banner to stdout; keep script output clean JSON.
    with contextlib.redirect_stdout(io.StringIO()):
        return page.find_tables()


def _find_page(
    doc: Any,
    needle: str,
    *,
    require_pattern: str | None = None,
    require_wide_table: bool = False,
    start: int = 2,
) -> int | None:
    """Locate the first content page matching ``needle`` (skips the table of contents)."""
    for index in range(start, min(40, doc.page_count)):
        text = doc[index].get_text()
        if needle not in text:
            continue
        if require_pattern is not None and re.search(require_pattern, text) is None:
            continue
        if require_wide_table:
            tables = _find_tables(doc[index])
            widest = max(
                (len(t.extract()[0]) for t in tables.tables if t.extract()),
                default=0,
            )
            if widest < 15:
                continue
        return index
    return None


def _extract_cover(doc: Any) -> tuple[str, str | None, str | None, str | None]:
    text = doc[0].get_text()
    stage = "final" if "Final Compliance Report" in text else (
        "interim" if "Interim Compliance Report" in text else "unknown"
    )
    range_match = _DATE_RANGE.search(" ".join(text.split()))
    cover_start = _iso_date(range_match.group(1)) if range_match else None
    cover_end = _iso_date(range_match.group(2)) if range_match else None
    all_dates = re.findall(_DATE, " ".join(text.split()))
    # The last standalone date on the cover is the publication date.
    publication = _iso_date(all_dates[-1]) if all_dates else None
    return stage, publication, cover_start, cover_end


def _extract_monitoring_window(doc: Any) -> tuple[str | None, str | None]:
    for index in range(min(20, doc.page_count)):
        flat = " ".join(doc[index].get_text().split())
        match = _MONITORING.search(flat)
        if match:
            return _iso_date(match.group(1)), _iso_date(match.group(2))
    return None, None


def _extract_commitments(doc: Any) -> tuple[list[RioCommitment], list[str]]:
    warnings: list[str] = []
    page = _find_page(
        doc,
        "Commitments Selected for Compliance Monitoring",
        require_pattern=r"\(2024-\d+\)",
    )
    if page is None:
        return [], ["table1_not_found"]
    text = doc[page].get_text()
    anchor = text.find("Compliance Monitoring")
    newline = text.find("\n", anchor)
    body = text[newline + 1 :] if newline >= 0 else text
    commitments: list[RioCommitment] = []
    cursor = 0
    for match in _COMMITMENT_ID.finditer(body):
        segment = body[cursor : match.start()]
        cursor = match.end()
        order_match = _ORDER.match(segment)
        if order_match is None:
            continue
        order = int(order_match.group(1))
        exact = _norm_ws(order_match.group(2))
        if exact:
            commitments.append(RioCommitment(order, f"2024-{match.group(1)}", exact))
    commitments.sort(key=lambda c: c.order)
    orders = [c.order for c in commitments]
    if orders != list(range(1, len(orders) + 1)):
        warnings.append("table1_commitment_ordering_unexpected")
    return commitments, warnings


def _normalize_score(cell: str) -> str:
    token = _norm_ws(cell)
    if token in {"−1", "-1"}:
        return "-1"
    if token.lower() in {"n/a", "na", "n.a."}:
        return "not_applicable"
    if token in {"+1", "0"}:
        return token
    return token  # anything else (incl. "") is quarantined downstream


def _extract_scores(doc: Any) -> tuple[list[str], list[RioScoreCell], list[str]]:
    warnings: list[str] = []
    page = _find_page(doc, "Compliance Scores", require_wide_table=True)
    if page is None:
        return [], [], ["table2_not_found"]
    tables = _find_tables(doc[page])
    candidates = [t for t in tables.tables if t.extract()]
    if not candidates:
        return [], [], ["table2_no_table"]
    table = max(candidates, key=lambda t: len(t.extract()[0]))
    rows = table.extract()
    header = [_norm_ws(cell) for cell in rows[0]]
    avg_index = header.index("Average") if "Average" in header else len(header)
    members = header[2:avg_index]  # positional; blanks kept for alignment
    clean_members = [member for member in members if member]
    scores: list[RioScoreCell] = []
    for row in rows[1:]:
        first = _norm_ws(row[0])
        if not first.isdigit():
            continue
        order = int(first)
        cells = [_norm_ws(cell) for cell in row[2 : 2 + len(members)]]
        for member, cell in zip(members, cells):
            if not member:
                continue
            scores.append(RioScoreCell(order, member, _normalize_score(cell)))
    if not clean_members:
        warnings.append("table2_no_members")
    return clean_members, scores, warnings


def parse_report(payload: bytes) -> RioExtraction:
    """Extract one Rio compliance report; raises only on a corrupt PDF."""
    doc = _open(payload)
    try:
        stage, publication, cover_start, cover_end = _extract_cover(doc)
        window_start, window_end = _extract_monitoring_window(doc)
        commitments, commitment_warnings = _extract_commitments(doc)
        members, scores, score_warnings = _extract_scores(doc)
    finally:
        doc.close()
    warnings = [*commitment_warnings, *score_warnings]
    # The final report's cover coverage span differs from the monitoring window;
    # record the discrepancy rather than silently choosing one.
    if (
        cover_end is not None
        and window_end is not None
        and cover_end != window_end
    ):
        warnings.append(f"cover_window_end_differs:{cover_end}")
    return RioExtraction(
        stage=stage,
        publication_date=publication,
        monitoring_window_start=window_start,
        monitoring_window_end=window_end,
        cover_window_start=cover_start,
        cover_window_end=cover_end,
        members=tuple(members),
        commitments=tuple(commitments),
        scores=tuple(scores),
        warnings=tuple(warnings),
    )


def score_rows(payload: bytes) -> list[dict[str, Any]]:
    """Score matrix as plain row dicts, for ``run_parser_safely`` containment."""
    _members, cells, _warnings = _extract_scores(_open(payload))
    return [
        {
            "commitment_order": cell.commitment_order,
            "member": cell.member,
            "raw_score": cell.raw_score,
        }
        for cell in cells
    ]
