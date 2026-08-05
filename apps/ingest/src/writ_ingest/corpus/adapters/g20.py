"""Adapter for the G20 Research Group 2024 Rio compliance reports.

Reads the frozen fixture excerpts (Stage 1) or raw bytes supplied from the online
store (Stage 2), parses the interim and final reports, and emits version ``2.0.0``
records. It imports published scores exactly, keeps interim and final reports as
separate records, and never infers a score, date, or commitment: ambiguous or
missing extractions become review items instead.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..parsers.g20_rio import parse_report, score_rows
from ..parsing import extract_member_assessment_row, run_parser_safely
from ..registry import find_repo_root, get_source, load_registry
from ..review_queue import make_review_item
from ..validation import CorpusValidationError
from ..vocabulary import load_vocabulary, resolve_vocabulary
from .base import AdapterOutput

SOURCE_ID = "g20_research_group"
INSTITUTION = "G20"
SUMMIT_ID = "G20.rio.2024"
SUMMIT_SLUG = "2024-rio"
PARSER_VERSION = "g20-2024-rio-adapter@2.0.0"
DATASET_DIR = "archive/compatibility/g20/2024-rio"
SOURCES_FIXTURE = f"{DATASET_DIR}/sources/source-manifest.json"

REPORT_IDS = {
    "final": "g20.2024.rio.final.compliance",
    "interim": "g20.2024.rio.interim.compliance",
}
RECONCILIATION_ID = "g20.2024-rio.reconciliation"
INVENTORY_SOURCE_ID = "g20.2024-rio.leaders-declaration"
EXPECTED_INVENTORY_COUNT = 174

# The 13 selected-commitment issue areas, keyed by their printed order in Table 1.
# These are the report's own section headings and resolve through reviewed vocabulary.
ISSUE_AREA_BY_ORDER = {
    1: "Energy: Energy Transition Supply Chains",
    2: "Development: Financial Support for Low- and Middle-Income Countries",
    3: "Development: Integration of the African Union",
    4: "Institutional Reform: Reforming Global Governance Institutions",
    5: "Climate Change: Greenhouse Gas Reduction",
    6: "Climate Change: Disaster Risk Reduction",
    7: "Environment: Biodiversity",
    8: "Health: Inclusive Health Systems",
    9: "Macroeconomics: Fiscal Policy",
    10: "Regional Security: Humanitarian Efforts in Gaza and Lebanon",
    11: "Food and Agriculture: Fertilizer Shortages",
    12: "Gender Equality: Labour Markets",
    13: "Digitalization: Digital Platform Transparency",
}


class G20RioAdapter:
    """Emit normalized candidates for the 2024 Rio interim and final reports."""

    def __init__(
        self,
        root: Path | None = None,
        payloads: dict[str, bytes] | None = None,
    ) -> None:
        self.root = root or find_repo_root()
        # Optional document_id -> raw bytes override (Stage 2 reads from Neon).
        self.payloads = payloads or {}

    def _json(self, relative: str) -> dict[str, Any]:
        value = json.loads((self.root / relative).read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise TypeError(f"fixture must be an object: {relative}")
        return value

    def _payload(self, document_version: dict[str, Any]) -> bytes:
        document_id = str(document_version["document_id"])
        if document_id in self.payloads:
            return self.payloads[document_id]
        # The archived manifest records the dataset-relative path from the layout
        # in use before the dataset moved under `archive/compatibility/`. Its bytes
        # are frozen, so the recorded path is rebased onto the current dataset root.
        recorded = str(document_version["fixture_path"])
        _, _, within = recorded.partition(f"/{SUMMIT_SLUG}/")
        return (self.root / DATASET_DIR / (within or recorded)).read_bytes()

    def emit(self) -> AdapterOutput:
        vocabulary = load_vocabulary()
        source = get_source(load_registry(), SOURCE_ID)
        label_authority = source["historical_label"]["label_authority"]
        versions = {
            str(entry["stage"]): entry
            for entry in self._json(SOURCES_FIXTURE)["document_versions"]
        }
        retrieval_date = str(versions["final"]["retrieved_at"])

        parsed = {stage: parse_report(self._payload(entry)) for stage, entry in versions.items()}
        final = parsed["final"]

        commitments: list[dict[str, Any]] = []
        selections: list[dict[str, Any]] = []
        reviews: list[dict[str, Any]] = []
        passage_ids: set[str] = set()
        order_to_commitment: dict[int, str] = {}

        for commitment in final.commitments:
            commitment_id = commitment.commitment_id
            order_to_commitment[commitment.order] = commitment_id
            issue_term = ISSUE_AREA_BY_ORDER.get(commitment.order, "")
            issue = resolve_vocabulary(
                vocabulary,
                namespace="issue_area",
                source_id=SOURCE_ID,
                source_term=issue_term,
            )
            passage = f"g20.2024-rio.commitment.{commitment_id}"
            passage_ids.add(passage)
            commitments.append(
                {
                    "schema_version": "2.0.0",
                    "record_type": "identified_commitment",
                    "institution": INSTITUTION,
                    "summit_id": SUMMIT_ID,
                    "commitment_id": commitment_id,
                    "exact_text": commitment.exact_text,
                    "issue_areas": [
                        {
                            "source_term": issue.source_term,
                            "vocabulary_mapping_id": issue.mapping_id,
                        }
                    ],
                    "source_passage_ids": [passage],
                    "parser_version": PARSER_VERSION,
                    "retrieval_date": retrieval_date,
                    "extraction_warnings": (
                        ["issue_area_mapping_not_reviewed"] if issue.requires_review else []
                    ),
                }
            )
            selection_identity = f"{INSTITUTION}:{SUMMIT_ID}:{commitment_id}"
            selections.append(
                {
                    "schema_version": "2.0.0",
                    "record_type": "assessment_selection",
                    "institution": INSTITUTION,
                    "summit_id": SUMMIT_ID,
                    "commitment_id": commitment_id,
                    "selection_status": "selected",
                    "selection_source_id": str(versions["final"]["document_id"]),
                    "selection_date": None,
                    "reconciliation_manifest_id": None,
                    "parser_version": PARSER_VERSION,
                    "retrieval_date": retrieval_date,
                    "extraction_warnings": ["selection_date_not_published"],
                }
            )
            reviews.append(
                make_review_item(
                    source_id=SOURCE_ID,
                    passage_id=passage,
                    page_or_section="table1",
                    issue_type="missing_required_date",
                    parser_version=PARSER_VERSION,
                    affected_record_ids=[selection_identity],
                    original_source_text=commitment_id,
                )
            )

        # The report states 174 total commitments; only the 13 selected are
        # enumerated here. Record the count gap rather than fabricating the rest.
        reconciliations = [
            {
                "schema_version": "2.0.0",
                "record_type": "reconciliation_manifest",
                "reconciliation_manifest_id": RECONCILIATION_ID,
                "institution": INSTITUTION,
                "summit_id": SUMMIT_ID,
                "inventory_source_id": INVENTORY_SOURCE_ID,
                "selected_subset_source_id": str(versions["final"]["document_id"]),
                "extracted_inventory_count": len(commitments),
                "extracted_selected_count": len(selections),
                "expected_inventory_count": EXPECTED_INVENTORY_COUNT,
                "expected_selected_count": len(selections),
                "validation_status": "incomplete",
                "reconciliation_warnings": [
                    "full_inventory_not_enumerated_from_report_source",
                    "inventory_source_document_not_ingested",
                ],
                "parser_version": PARSER_VERSION,
                "retrieval_date": retrieval_date,
            }
        ]
        reviews.append(
            make_review_item(
                source_id=SOURCE_ID,
                passage_id=None,
                page_or_section="table1",
                issue_type="incomplete_reconciliation",
                parser_version=PARSER_VERSION,
                affected_record_ids=[RECONCILIATION_ID],
                original_source_text=(
                    f"{EXPECTED_INVENTORY_COUNT} total commitments; "
                    f"{len(selections)} selected for monitoring"
                ),
            )
        )

        # Commitments must match across the interim and final selection tables.
        for stage, extraction in parsed.items():
            other = {c.order: c.commitment_id for c in extraction.commitments}
            if other != order_to_commitment:
                reviews.append(
                    make_review_item(
                        source_id=SOURCE_ID,
                        passage_id=None,
                        page_or_section=f"{stage}.table1",
                        issue_type="conflicting_source_records",
                        parser_version=PARSER_VERSION,
                        affected_record_ids=[REPORT_IDS[stage]],
                        original_source_text="selected commitment set differs from final report",
                    )
                )

        reports: list[dict[str, Any]] = []
        assessments: list[dict[str, Any]] = []
        source_document_ids: set[str] = set()

        for stage in ("final", "interim"):
            extraction = parsed[stage]
            entry = versions[stage]
            report_id = REPORT_IDS[stage]
            document_id = str(entry["document_id"])
            source_document_ids.add(document_id)
            scores_passage = f"g20.2024-rio.{stage}.scores"
            passage_ids.add(scores_passage)
            window_warnings = sorted(
                warning
                for warning in extraction.warnings
                if warning.startswith("cover_window_end_differs")
            )
            reports.append(
                {
                    "schema_version": "2.0.0",
                    "record_type": "compliance_report",
                    "report_id": report_id,
                    "institution": INSTITUTION,
                    "summit_id": SUMMIT_ID,
                    "report_stage": stage,
                    "assessment_window_start": extraction.monitoring_window_start,
                    "assessment_window_end": extraction.monitoring_window_end,
                    "publication_date": extraction.publication_date,
                    "supersedes_report_id": None,
                    "source_document_id": document_id,
                    "parser_version": PARSER_VERSION,
                    "retrieval_date": str(entry["retrieved_at"]),
                    "extraction_warnings": window_warnings,
                }
            )
            for warning in window_warnings:
                reviews.append(
                    make_review_item(
                        source_id=SOURCE_ID,
                        passage_id=None,
                        page_or_section="cover",
                        issue_type="conflicting_source_records",
                        parser_version=PARSER_VERSION,
                        affected_record_ids=[report_id],
                        original_source_text=warning,
                    )
                )

            parsed_scores = run_parser_safely(score_rows, self._payload(entry))
            if parsed_scores.failed:
                reviews.append(
                    make_review_item(
                        source_id=SOURCE_ID,
                        passage_id=scores_passage,
                        page_or_section="table2",
                        issue_type="scoring_affecting_parser_warning",
                        parser_version=PARSER_VERSION,
                        affected_record_ids=[report_id],
                        original_source_text=";".join(parsed_scores.warnings),
                    )
                )
                continue

            for row in parsed_scores.records:
                order = int(row["commitment_order"])
                member_name = str(row["member"])
                raw_score = str(row["raw_score"])
                row_commitment_id = order_to_commitment.get(order)
                if row_commitment_id is None:
                    reviews.append(
                        make_review_item(
                            source_id=SOURCE_ID,
                            passage_id=scores_passage,
                            page_or_section="table2",
                            issue_type="ambiguous_commitment_identity",
                            parser_version=PARSER_VERSION,
                            affected_record_ids=[f"{report_id}.row.{order}"],
                            original_source_text=f"commitment order {order}",
                        )
                    )
                    continue
                member_id = self._resolve_member(vocabulary, member_name)
                if member_id is None:
                    reviews.append(
                        make_review_item(
                            source_id=SOURCE_ID,
                            passage_id=scores_passage,
                            page_or_section="table2",
                            issue_type="ambiguous_member_identity",
                            parser_version=PARSER_VERSION,
                            affected_record_ids=[
                                f"{report_id}.{row_commitment_id}.{member_name}"
                            ],
                            original_source_text=member_name,
                        )
                    )
                    continue
                base_record = {
                    "schema_version": "2.0.0",
                    "record_type": "member_compliance_assessment",
                    "assessment_id": f"{report_id}.{row_commitment_id}.{member_id}",
                    "report_id": report_id,
                    "commitment_id": row_commitment_id,
                    "member_id": member_id,
                    "source_passage_ids": [scores_passage],
                    "analyst_reasoning": None,
                    "historical_label": {
                        "label_type": "expert_assigned_historical_score",
                        "label_authority": label_authority,
                        "usable_for_training_examples": True,
                        "usable_for_evaluation": True,
                        "usable_for_automatic_score_transfer": False,
                    },
                    "parser_version": PARSER_VERSION,
                    "retrieval_date": str(entry["retrieved_at"]),
                    "extraction_warnings": [],
                }
                extracted = extract_member_assessment_row(
                    base_record=base_record,
                    raw_score=raw_score,
                    identity_status="clear",
                    source_id=SOURCE_ID,
                    passage_id=scores_passage,
                    page_or_section="table2",
                    original_source_text=raw_score,
                )
                assessments.extend(extracted.assessments)
                reviews.extend(extracted.review_items)

        return AdapterOutput(
            commitments=tuple(commitments),
            selections=tuple(selections),
            reports=tuple(reports),
            member_assessments=tuple(assessments),
            reconciliations=tuple(reconciliations),
            review_items=tuple(reviews),
            passage_ids=frozenset(passage_ids),
            source_document_ids=frozenset(source_document_ids),
        )

    @staticmethod
    def _resolve_member(vocabulary: dict[str, Any], member_name: str) -> str | None:
        try:
            resolution = resolve_vocabulary(
                vocabulary,
                namespace="member_name",
                source_id=SOURCE_ID,
                source_term=member_name,
            )
        except CorpusValidationError:
            return None
        return resolution.canonical_term
