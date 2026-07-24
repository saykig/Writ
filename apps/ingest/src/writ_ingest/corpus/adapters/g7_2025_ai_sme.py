"""Adapter for the frozen 2025 G7 AI-for-SMEs regression fixture."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..registry import find_repo_root
from ..review_queue import make_review_item
from ..vocabulary import load_vocabulary, resolve_vocabulary
from .base import AdapterOutput

SOURCE_ID = "g7.evaluations.2025.final"
PARSER_VERSION = "g7-2025-ai-sme-fixture-adapter@2.0.0"
SUMMIT_ID = "G7.kananaskis.2025"
REPORT_ID = "g7.2025.kananaskis.final.compliance"


class G7AiSmeFixtureAdapter:
    """Read frozen JSON fixture artifacts without importing benchmark runtime types."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = root or find_repo_root()

    def _json(self, relative: str) -> dict[str, Any]:
        value = json.loads((self.root / relative).read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise TypeError(f"fixture must be an object: {relative}")
        return value

    def emit(self) -> AdapterOutput:
        inventory = self._json("benchmark/2025-ai-sme/methodology-inventory.json")
        sources = self._json("benchmark/2025-ai-sme/sources.json")
        vocabulary = load_vocabulary()
        source_document = sources["document_version"]
        retrieval_date = str(source_document["retrieved_at"])[:10]
        publication_date = str(source_document["issued_at"])[:10]
        source_document_id = str(source_document["document_id"])
        passage_ids = frozenset(str(item["id"]) for item in sources["passages"])

        institution = resolve_vocabulary(
            vocabulary,
            namespace="institution",
            source_id=SOURCE_ID,
            source_term="G7",
        )
        report_term = resolve_vocabulary(
            vocabulary,
            namespace="report_terminology",
            source_id=SOURCE_ID,
            source_term="final compliance",
        )
        resolve_vocabulary(
            vocabulary,
            namespace="document_classification",
            source_id=SOURCE_ID,
            source_term="final compliance chapter",
        )
        issue = resolve_vocabulary(
            vocabulary,
            namespace="issue_area",
            source_id=SOURCE_ID,
            source_term=str(inventory["chapter"]["title"]),
        )
        if institution.canonical_term != "G7" or report_term.canonical_term != "final":
            raise ValueError("reviewed G7 fixture vocabulary mappings are unavailable")

        commitment_id = str(inventory["commitment_id"])
        commitment = {
            "schema_version": "2.0.0",
            "record_type": "identified_commitment",
            "institution": institution.canonical_term,
            "summit_id": SUMMIT_ID,
            "commitment_id": commitment_id,
            "exact_text": inventory["commitment_text"],
            "issue_areas": [
                {
                    "source_term": issue.source_term,
                    "vocabulary_mapping_id": issue.mapping_id,
                }
            ],
            "source_passage_ids": ["passage-commitment-text"],
            "parser_version": PARSER_VERSION,
            "retrieval_date": retrieval_date,
            "extraction_warnings": (
                ["issue_area_mapping_not_reviewed"] if issue.requires_review else []
            ),
        }

        selection_identity = f"G7:{SUMMIT_ID}:{commitment_id}"
        selection = {
            "schema_version": "2.0.0",
            "record_type": "assessment_selection",
            "institution": "G7",
            "summit_id": SUMMIT_ID,
            "commitment_id": commitment_id,
            "selection_status": "selected",
            "selection_source_id": source_document_id,
            "selection_date": None,
            "reconciliation_manifest_id": None,
            "parser_version": PARSER_VERSION,
            "retrieval_date": retrieval_date,
            "extraction_warnings": ["selection_date_not_published"],
        }

        report = {
            "schema_version": "2.0.0",
            "record_type": "compliance_report",
            "report_id": REPORT_ID,
            "institution": "G7",
            "summit_id": SUMMIT_ID,
            "report_stage": "final",
            "assessment_window_start": inventory["evaluation_window"]["start"],
            "assessment_window_end": inventory["evaluation_window"]["end"],
            "publication_date": publication_date,
            "supersedes_report_id": None,
            "source_document_id": source_document_id,
            "parser_version": PARSER_VERSION,
            "retrieval_date": retrieval_date,
            "extraction_warnings": [],
        }

        assessments: list[dict[str, Any]] = []
        reviews = [
            make_review_item(
                source_id=SOURCE_ID,
                passage_id="passage-commitment-text",
                page_or_section="methodology-inventory.chapter.title",
                issue_type="proposed_vocabulary_mapping",
                parser_version=PARSER_VERSION,
                affected_record_ids=[issue.mapping_id, commitment_id],
                original_source_text=issue.source_term,
            ),
            make_review_item(
                source_id=SOURCE_ID,
                passage_id="passage-commitment-text",
                page_or_section="methodology-inventory.chapter",
                issue_type="missing_required_date",
                parser_version=PARSER_VERSION,
                affected_record_ids=[selection_identity],
                original_source_text=str(inventory["chapter"]["title"]),
            ),
        ]
        for source_member in inventory["subjects"]:
            member = resolve_vocabulary(
                vocabulary,
                namespace="member_name",
                source_id=SOURCE_ID,
                source_term=str(source_member),
            )
            if member.canonical_term is None:
                raise ValueError(f"G7 fixture member mapping is not reviewed: {source_member}")
            assessment_id = f"{REPORT_ID}.{commitment_id}.{member.canonical_term}"
            result = inventory["observed_results"][source_member]
            assessments.append(
                {
                    "schema_version": "2.0.0",
                    "record_type": "member_compliance_assessment",
                    "assessment_id": assessment_id,
                    "report_id": REPORT_ID,
                    "commitment_id": commitment_id,
                    "member_id": member.canonical_term,
                    "published_result": result,
                    "score_status": "published",
                    "source_passage_ids": [],
                    "analyst_reasoning": None,
                    "dispute_reason": None,
                    "current_view_status": "included",
                    "historical_label": {
                        "label_type": "expert_assigned_historical_score",
                        "label_authority": "G7 Research Group",
                        "usable_for_training_examples": True,
                        "usable_for_evaluation": True,
                        "usable_for_automatic_score_transfer": False,
                    },
                    "parser_version": PARSER_VERSION,
                    "retrieval_date": retrieval_date,
                    "extraction_warnings": ["published_score_passage_not_isolated"],
                }
            )
            reviews.append(
                make_review_item(
                    source_id=SOURCE_ID,
                    passage_id=None,
                    page_or_section=f"methodology-inventory.observed_results.{source_member}",
                    issue_type="scoring_affecting_parser_warning",
                    parser_version=PARSER_VERSION,
                    affected_record_ids=[assessment_id],
                    original_source_text=str(result),
                )
            )

        return AdapterOutput(
            commitments=(commitment,),
            selections=(selection,),
            reports=(report,),
            member_assessments=tuple(assessments),
            reconciliations=(),
            review_items=tuple(reviews),
            passage_ids=passage_ids,
            source_document_ids=frozenset({source_document_id}),
        )
