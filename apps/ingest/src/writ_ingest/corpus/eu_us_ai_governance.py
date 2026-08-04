"""Deterministic migration and validation for the EU and US AI-governance corpora."""

from __future__ import annotations

import copy
import hashlib
import json
import re
import uuid
from pathlib import Path
from typing import Any, Literal, TypedDict

import yaml

from .registry import find_repo_root

ARCHIVE_RELATIVE_DIR = Path("archive/pilots/eu-us-ai-evaluation-v1")
ARCHIVE_ORIGINAL_RELATIVE_DIR = ARCHIVE_RELATIVE_DIR / "original"
REVIEWED_RELATIVE_PATH = (
    ARCHIVE_ORIGINAL_RELATIVE_DIR / "annotations" / "human-reviewed.yaml"
)
DOCUMENT_VERSIONS_RELATIVE_PATH = (
    ARCHIVE_ORIGINAL_RELATIVE_DIR / "provenance" / "document-versions.json"
)
PASSAGES_RELATIVE_PATH = ARCHIVE_ORIGINAL_RELATIVE_DIR / "provenance" / "passages.json"
UNRESOLVED_RELATIVE_PATH = ARCHIVE_ORIGINAL_RELATIVE_DIR / "provenance" / "unresolved.json"
SNAPSHOT_RELATIVE_PATHS = {
    "EU": ARCHIVE_ORIGINAL_RELATIVE_DIR / "evidence" / "eu.snapshot.json",
    "US": ARCHIVE_ORIGINAL_RELATIVE_DIR / "evidence" / "us.snapshot.json",
}

CORPUS_RELATIVE_DIRS = {
    "EU": Path("corpora/jurisdictions/eu/ai-governance"),
    "US": Path("corpora/jurisdictions/us/ai-governance"),
}

EXPECTED_REVIEWED_SHA256 = (
    "8de1e3b84a15875a39f3de2857f68dcd3040830ad72ffd9728c1ded0eda07cbb"
)
IDENTITY_NAMESPACE = uuid.UUID("6f806bca-a20b-5e2f-a445-6a15e6958ef4")
IDENTITY_NAMESPACE_URN = f"urn:uuid:{IDENTITY_NAMESPACE}"
IDENTITY_DERIVATION = (
    "UUIDv5(namespace, 'eu-us-ai-governance-v1:<record-kind>:<immutable-import-key>')"
)

CLAIM_REFS = {
    "EU-01": "eu/ai-governance/ai-act/art-53-1-a#technical-documentation",
    "EU-02": "eu/ai-governance/ai-act/art-53-1-b#downstream-documentation",
    "EU-03": "eu/ai-governance/ai-act/art-53-1-c#copyright-policy",
    "EU-04": "eu/ai-governance/ai-act/art-53-1-d#training-content-summary",
    "EU-05": "eu/ai-governance/ai-act/art-53-2#open-source-exception",
    "EU-06": "eu/ai-governance/ai-act/art-55-1-a#model-evaluation",
    "EU-07": "eu/ai-governance/ai-act/art-55-1-b#systemic-risk-assessment",
    "EU-08": "eu/ai-governance/ai-act/art-55-1-c#incident-reporting",
    "EU-09": "eu/ai-governance/ai-act/art-55-1-d#cybersecurity-protection",
    "EU-10A": (
        "eu/ai-governance/commission-gpai-guidelines/classification"
        "#regulatory-classification"
    ),
    "EU-10B": (
        "eu/ai-governance/commission-gpai-guidelines/notification"
        "#regulatory-notification"
    ),
    "EU-10C": (
        "eu/ai-governance/commission-gpai-guidelines/compliance"
        "#compliance-demonstration"
    ),
    "EU-11A": "eu/ai-governance/ai-act/art-113#application-from-2025-08-02",
    "EU-11B": "eu/ai-governance/ai-act/art-113#existing-model-transition",
    "EU-12": (
        "eu/ai-governance/gpai-code-of-practice/signatory-notice"
        "#recognized-compliance-path"
    ),
    "US-01": "us/ai-governance/nist-ai-rmf/abstract#risk-management",
    "US-02": "us/ai-governance/nist-ai-rmf/playbook-overview#implementation-guidance",
    "US-03": (
        "us/ai-governance/nist-generative-ai-profile/abstract#model-evaluation"
    ),
    "US-04": "us/ai-governance/caisi/overview#evaluation-participation",
    "US-05A": (
        "us/ai-governance/caisi-guidelines/published-guidelines#model-evaluation"
    ),
    "US-05B": (
        "us/ai-governance/caisi-guidelines/draft-benchmark-practices"
        "#proposed-model-evaluation-guidance"
    ),
    "US-06": (
        "us/ai-governance/executive-order-14179/january-2025-fact-sheet"
        "#administrative-policy-revision"
    ),
    "US-07": "us/ai-governance/omb-m-25-21/covered-ai#agency-scope",
    "US-08A": "us/ai-governance/omb-m-25-21/high-impact-ai#pre-deployment-testing",
    "US-08B": "us/ai-governance/omb-m-25-21/high-impact-ai#risk-assessment",
    "US-09A": "us/ai-governance/omb-m-25-22/selection-and-award#procurement-testing",
    "US-09B": (
        "us/ai-governance/omb-m-25-22/selection-and-award"
        "#contract-terms-requirement"
    ),
    "US-09C": (
        "us/ai-governance/omb-m-25-22/selection-and-award#vendor-evaluation-access"
    ),
    "US-10A": (
        "us/ai-governance/omb-m-25-22/ongoing-testing-and-monitoring"
        "#contract-documentation"
    ),
    "US-10B": (
        "us/ai-governance/omb-m-25-22/ongoing-testing-and-monitoring"
        "#monitoring-support"
    ),
    "US-11": (
        "us/ai-governance/national-ai-policy-framework/december-2025-fact-sheet"
        "#proposed-reporting-and-disclosure"
    ),
    "US-12": (
        "us/ai-governance/americas-ai-action-plan/evaluation-ecosystem"
        "#evaluation-infrastructure"
    ),
}

FORBIDDEN_ACTIVE_KEYS = frozenset(
    {
        "dataset_id",
        "pilot_question",
        "headline_rule",
        "headline_judgments",
        "headline_relevance",
    }
)
IDENTITY_FIELDS = ("machine_id", "ref", "display_ref", "aliases", "legacy_refs")
PARENT_ONLY_FIELDS = frozenset({"row_id", "review_decision", "record_type", "derived_claims"})
CHILD_ONLY_FIELDS = frozenset({"claim_id", "record_type"})
INHERITED_PARENT_FIELDS = ("jurisdiction", "instrument", "source_locator", "interpretation_note")
REMOVED_NORMALIZED_FIELDS = frozenset(
    {
        "schema_version",
        "record_type",
        "parser_version",
        "claim_id",
        "parent_row_id",
        "claim_origin",
        "headline_relevance",
    }
)

MappingStatus = Literal["mapped", "unmapped", "unresolved", "error"]
ResultKind = Literal["semantic", "identity"]


class DiagnosticIdentity(TypedDict, total=False):
    """Identity coordinates carried only by the read-only diagnostic projection."""

    jurisdiction: str
    object_kind: str
    id: str
    parent_id: str
    document_version_id: str
    passage_id: str
    legacy_refs: list[str]


class DiagnosticResult(TypedDict):
    """Internal result shape; it is not a schema or public interchange contract."""

    result_kind: ResultKind
    mapping_status: MappingStatus
    reason_code: str
    source_concept: str
    target_concept: str | None
    source_identity: DiagnosticIdentity
    target_identity: DiagnosticIdentity | None
    mapped_values: dict[str, str]
    unmapped_concepts: list[str]
    source_pointer: str
    passage_id: str | None
    evidence_link_position: int | None


SEMANTIC_VALUES = {
    "stance": frozenset({"supports", "contradicts", "qualifies", "context_only"}),
    "support_type": frozenset({"direct", "derived", "corroborating", "negative_search"}),
    "truth_value": frozenset({"true", "false", "unknown", "contested"}),
    "workflow_status": frozenset(
        {"candidate", "accepted", "rejected", "contested", "superseded", "withdrawn"}
    ),
    "reviewed_parent_decision": frozenset({"accepted"}),
    "snapshot_review_decision": frozenset(
        {"accept", "reject", "contest", "request_changes", "approve", "withdraw"}
    ),
}

INVALID_SEMANTIC_REASONS = {
    "stance": "INVALID_STANCE",
    "support_type": "INVALID_SUPPORT_TYPE",
    "truth_value": "INVALID_TRUTH_VALUE",
    "workflow_status": "INVALID_WORKFLOW_STATUS",
    "reviewed_parent_decision": "INVALID_REVIEWED_PARENT_DECISION",
    "snapshot_review_decision": "INVALID_SNAPSHOT_REVIEW_DECISION",
}


class CorpusMigrationError(ValueError):
    """The archived review input or active corpus violates the migration contract."""


def _machine_id(record_kind: str, immutable_import_key: str) -> str:
    name = f"eu-us-ai-governance-v1:{record_kind}:{immutable_import_key}"
    return str(uuid.uuid5(IDENTITY_NAMESPACE, name))


def _identity(
    *,
    record_kind: str,
    immutable_import_key: str,
    ref: str,
    display_ref: str,
    aliases: list[str] | None = None,
    legacy_refs: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "machine_id": _machine_id(record_kind, immutable_import_key),
        "ref": ref,
        "display_ref": display_ref,
        "aliases": aliases or [],
        "legacy_refs": legacy_refs or [],
    }


def _read_yaml(path: Path) -> dict[str, Any]:
    value = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise CorpusMigrationError(f"expected YAML mapping: {path}")
    return value


def _read_json(path: Path) -> list[dict[str, Any]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list) or not all(isinstance(item, dict) for item in value):
        raise CorpusMigrationError(f"expected JSON object array: {path}")
    return value


def _read_json_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise CorpusMigrationError(f"expected JSON object: {path}")
    return value


def reviewed_input_sha256(*, root: Path | None = None) -> str:
    repo_root = root or find_repo_root()
    return hashlib.sha256((repo_root / REVIEWED_RELATIVE_PATH).read_bytes()).hexdigest()


def load_reviewed_input(*, root: Path | None = None) -> dict[str, Any]:
    repo_root = root or find_repo_root()
    actual_hash = reviewed_input_sha256(root=repo_root)
    if actual_hash != EXPECTED_REVIEWED_SHA256:
        raise CorpusMigrationError(
            f"reviewed input SHA-256 mismatch: expected {EXPECTED_REVIEWED_SHA256}, "
            f"found {actual_hash}"
        )
    return _read_yaml(repo_root / REVIEWED_RELATIVE_PATH)


def normalize_reviewed_claims(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    """Flatten reviewed bundles without inferring, defaulting, or merging any value."""
    claims: list[dict[str, Any]] = []
    for parent in dataset["records"]:
        parent_ref = parent["row_id"]
        if parent["record_type"] == "source_bundle":
            for child in parent["derived_claims"]:
                claim = {
                    "claim_id": child["claim_id"],
                    "parent_row_id": parent_ref,
                    "claim_origin": "derived_claim",
                    "claim_record_type": child["record_type"],
                }
                for key in INHERITED_PARENT_FIELDS:
                    if key in parent:
                        claim[key] = copy.deepcopy(parent[key])
                for key, value in child.items():
                    if key not in CHILD_ONLY_FIELDS:
                        claim[key] = copy.deepcopy(value)
                claims.append(claim)
        else:
            claim = {
                "claim_id": parent_ref,
                "parent_row_id": parent_ref,
                "claim_origin": "parent_record",
                "claim_record_type": parent["record_type"],
            }
            for key, value in parent.items():
                if key not in PARENT_ONLY_FIELDS:
                    claim[key] = copy.deepcopy(value)
            claims.append(claim)
    return claims


def semantic_dimensions_correspond(source_concept: str, target_concept: str) -> bool:
    """Return true only for like-for-like semantic dimensions.

    This guard documents that record basis is distinct without adding a basis projector or
    reading native Writ records into this compatibility adapter.
    """

    return source_concept == target_concept


def _diagnostic_result(
    *,
    result_kind: ResultKind,
    mapping_status: MappingStatus,
    reason_code: str,
    source_concept: str,
    target_concept: str | None,
    source_identity: DiagnosticIdentity,
    source_pointer: str,
    target_identity: DiagnosticIdentity | None = None,
    mapped_values: dict[str, str] | None = None,
    unmapped_concepts: list[str] | None = None,
    passage_id: str | None = None,
    evidence_link_position: int | None = None,
) -> DiagnosticResult:
    return {
        "result_kind": result_kind,
        "mapping_status": mapping_status,
        "reason_code": reason_code,
        "source_concept": source_concept,
        "target_concept": target_concept,
        "source_identity": copy.deepcopy(source_identity),
        "target_identity": copy.deepcopy(target_identity),
        "mapped_values": copy.deepcopy(mapped_values or {}),
        "unmapped_concepts": list(unmapped_concepts or []),
        "source_pointer": source_pointer,
        "passage_id": passage_id,
        "evidence_link_position": evidence_link_position,
    }


def project_explicit_semantic(
    *,
    source_concept: str,
    value: Any,
    source_identity: DiagnosticIdentity,
    source_pointer: str,
    target_concept: str | None = None,
    passage_id: str | None = None,
    evidence_link_position: int | None = None,
) -> DiagnosticResult:
    """Project an explicit Phase 1 source value without performing an identity join."""

    target = target_concept or source_concept
    allowed = SEMANTIC_VALUES.get(source_concept)
    if allowed is None:
        return _diagnostic_result(
            result_kind="semantic",
            mapping_status="error",
            reason_code="UNSUPPORTED_SEMANTIC_CONCEPT",
            source_concept=source_concept,
            target_concept=target,
            source_identity=source_identity,
            source_pointer=source_pointer,
            passage_id=passage_id,
            evidence_link_position=evidence_link_position,
        )
    if value is None:
        return _diagnostic_result(
            result_kind="semantic",
            mapping_status="unmapped",
            reason_code="SOURCE_VALUE_ABSENT",
            source_concept=source_concept,
            target_concept=target,
            source_identity=source_identity,
            source_pointer=source_pointer,
            unmapped_concepts=[target],
            passage_id=passage_id,
            evidence_link_position=evidence_link_position,
        )
    if not isinstance(value, str) or value not in allowed:
        return _diagnostic_result(
            result_kind="semantic",
            mapping_status="error",
            reason_code=INVALID_SEMANTIC_REASONS[source_concept],
            source_concept=source_concept,
            target_concept=target,
            source_identity=source_identity,
            source_pointer=source_pointer,
            passage_id=passage_id,
            evidence_link_position=evidence_link_position,
        )
    if not semantic_dimensions_correspond(source_concept, target):
        return _diagnostic_result(
            result_kind="semantic",
            mapping_status="unmapped",
            reason_code="NO_SEMANTIC_CORRESPONDENCE",
            source_concept=source_concept,
            target_concept=target,
            source_identity=source_identity,
            source_pointer=source_pointer,
            unmapped_concepts=[target],
            passage_id=passage_id,
            evidence_link_position=evidence_link_position,
        )
    return _diagnostic_result(
        result_kind="semantic",
        mapping_status="mapped",
        reason_code="EXACT_SOURCE_VALUE",
        source_concept=source_concept,
        target_concept=target,
        source_identity=source_identity,
        source_pointer=source_pointer,
        mapped_values={target: value},
        passage_id=passage_id,
        evidence_link_position=evidence_link_position,
    )


def _active_identity(record: dict[str, Any], object_kind: str) -> DiagnosticIdentity:
    return {
        "jurisdiction": str(record.get("jurisdiction", "")),
        "object_kind": object_kind,
        "id": str(record.get("machine_id", "")),
        "legacy_refs": [str(value) for value in record.get("legacy_refs", [])],
    }


def _legacy_matches(records: list[dict[str, Any]], legacy_ref: str) -> list[dict[str, Any]]:
    return [record for record in records if legacy_ref in record.get("legacy_refs", [])]


def resolve_snapshot_claim_identity(
    *,
    snapshot_claim: dict[str, Any],
    active_claims: list[dict[str, Any]],
    jurisdiction: str,
    source_pointer: str,
) -> DiagnosticResult:
    snapshot_id = snapshot_claim.get("id")
    qualifiers = snapshot_claim.get("qualifiers")
    legacy_ref = qualifiers.get("row_id") if isinstance(qualifiers, dict) else None
    source_identity: DiagnosticIdentity = {
        "jurisdiction": jurisdiction,
        "object_kind": "snapshot_claim",
        "id": snapshot_id if isinstance(snapshot_id, str) else "",
        "legacy_refs": [legacy_ref] if isinstance(legacy_ref, str) else [],
    }
    if not isinstance(snapshot_id, str) or not snapshot_id or not isinstance(legacy_ref, str) or not legacy_ref:
        return _diagnostic_result(
            result_kind="identity",
            mapping_status="error",
            reason_code="CLAIM_IDENTIFIER_MISSING",
            source_concept="snapshot_claim_identity",
            target_concept="active_claim_identity",
            source_identity=source_identity,
            source_pointer=source_pointer,
        )
    matches = _legacy_matches(active_claims, legacy_ref)
    if not matches:
        status: MappingStatus = "unresolved"
        reason = "CLAIM_IDENTITY_NOT_FOUND"
    elif len(matches) > 1:
        status = "error"
        reason = "CLAIM_IDENTITY_AMBIGUOUS"
    else:
        return _diagnostic_result(
            result_kind="identity",
            mapping_status="mapped",
            reason_code="CLAIM_IDENTITY_EXACT",
            source_concept="snapshot_claim_identity",
            target_concept="active_claim_identity",
            source_identity=source_identity,
            target_identity=_active_identity(matches[0], "active_claim"),
            source_pointer=source_pointer,
        )
    return _diagnostic_result(
        result_kind="identity",
        mapping_status=status,
        reason_code=reason,
        source_concept="snapshot_claim_identity",
        target_concept="active_claim_identity",
        source_identity=source_identity,
        source_pointer=source_pointer,
        unmapped_concepts=["active_claim_identity"],
    )


def resolve_snapshot_document_version_identity(
    *,
    snapshot_document: dict[str, Any],
    active_sources: list[dict[str, Any]],
    jurisdiction: str,
    source_pointer: str,
) -> DiagnosticResult:
    document_id = snapshot_document.get("id")
    source_identity: DiagnosticIdentity = {
        "jurisdiction": jurisdiction,
        "object_kind": "snapshot_document_version",
        "id": document_id if isinstance(document_id, str) else "",
        "legacy_refs": [document_id] if isinstance(document_id, str) else [],
    }
    if not isinstance(document_id, str) or not document_id:
        return _diagnostic_result(
            result_kind="identity",
            mapping_status="error",
            reason_code="DOCUMENT_VERSION_IDENTIFIER_MISSING",
            source_concept="snapshot_document_version_identity",
            target_concept="active_source_identity",
            source_identity=source_identity,
            source_pointer=source_pointer,
        )
    matches = _legacy_matches(active_sources, document_id)
    if not matches:
        status: MappingStatus = "unresolved"
        reason = "DOCUMENT_SOURCE_IDENTITY_NOT_FOUND"
    elif len(matches) > 1:
        status = "error"
        reason = "DOCUMENT_SOURCE_IDENTITY_AMBIGUOUS"
    else:
        return _diagnostic_result(
            result_kind="identity",
            mapping_status="mapped",
            reason_code="DOCUMENT_SOURCE_IDENTITY_EXACT",
            source_concept="snapshot_document_version_identity",
            target_concept="active_source_identity",
            source_identity=source_identity,
            target_identity=_active_identity(matches[0], "active_source"),
            source_pointer=source_pointer,
        )
    return _diagnostic_result(
        result_kind="identity",
        mapping_status=status,
        reason_code=reason,
        source_concept="snapshot_document_version_identity",
        target_concept="active_source_identity",
        source_identity=source_identity,
        source_pointer=source_pointer,
        unmapped_concepts=["active_source_identity"],
    )


def resolve_snapshot_passage_identity(
    *,
    snapshot_passage: dict[str, Any],
    active_passages: list[dict[str, Any]],
    active_sources: list[dict[str, Any]],
    jurisdiction: str,
    source_pointer: str,
) -> DiagnosticResult:
    passage_id = snapshot_passage.get("id")
    document_version_id = snapshot_passage.get("document_version_id")
    source_identity: DiagnosticIdentity = {
        "jurisdiction": jurisdiction,
        "object_kind": "snapshot_passage",
        "id": passage_id if isinstance(passage_id, str) else "",
        "passage_id": passage_id if isinstance(passage_id, str) else "",
        "document_version_id": (
            document_version_id if isinstance(document_version_id, str) else ""
        ),
        "legacy_refs": [passage_id] if isinstance(passage_id, str) else [],
    }
    if not isinstance(passage_id, str) or not passage_id:
        return _diagnostic_result(
            result_kind="identity",
            mapping_status="error",
            reason_code="PASSAGE_IDENTIFIER_MISSING",
            source_concept="snapshot_passage_identity",
            target_concept="active_passage_identity",
            source_identity=source_identity,
            source_pointer=source_pointer,
        )
    if not isinstance(document_version_id, str) or not document_version_id:
        return _diagnostic_result(
            result_kind="identity",
            mapping_status="error",
            reason_code="DOCUMENT_VERSION_IDENTIFIER_MISSING",
            source_concept="snapshot_passage_identity",
            target_concept="active_passage_identity",
            source_identity=source_identity,
            source_pointer=source_pointer,
            passage_id=passage_id,
        )
    matches = _legacy_matches(active_passages, passage_id)
    if not matches:
        status: MappingStatus = "unresolved"
        reason = "PASSAGE_IDENTITY_NOT_FOUND"
    elif len(matches) > 1:
        status = "error"
        reason = "PASSAGE_IDENTITY_AMBIGUOUS"
    else:
        source_matches = _legacy_matches(active_sources, document_version_id)
        if len(source_matches) == 1 and matches[0].get("source_machine_id") != source_matches[0].get(
            "machine_id"
        ):
            return _diagnostic_result(
                result_kind="identity",
                mapping_status="error",
                reason_code="PASSAGE_DOCUMENT_IDENTITY_INCONSISTENT",
                source_concept="snapshot_passage_identity",
                target_concept="active_passage_identity",
                source_identity=source_identity,
                source_pointer=source_pointer,
                passage_id=passage_id,
            )
        return _diagnostic_result(
            result_kind="identity",
            mapping_status="mapped",
            reason_code="PASSAGE_IDENTITY_EXACT",
            source_concept="snapshot_passage_identity",
            target_concept="active_passage_identity",
            source_identity=source_identity,
            target_identity=_active_identity(matches[0], "active_passage"),
            source_pointer=source_pointer,
            passage_id=passage_id,
        )
    return _diagnostic_result(
        result_kind="identity",
        mapping_status=status,
        reason_code=reason,
        source_concept="snapshot_passage_identity",
        target_concept="active_passage_identity",
        source_identity=source_identity,
        source_pointer=source_pointer,
        unmapped_concepts=["active_passage_identity"],
        passage_id=passage_id,
    )


def resolve_snapshot_reviewed_object_identity(
    *,
    snapshot_review: dict[str, Any],
    snapshot_objects: dict[str, list[dict[str, Any]]],
    jurisdiction: str,
    source_pointer: str,
) -> DiagnosticResult:
    review_id = snapshot_review.get("id")
    object_type = snapshot_review.get("object_type")
    object_id = snapshot_review.get("object_id")
    source_identity: DiagnosticIdentity = {
        "jurisdiction": jurisdiction,
        "object_kind": "snapshot_review",
        "id": review_id if isinstance(review_id, str) else "",
    }
    if (
        not isinstance(review_id, str)
        or not review_id
        or not isinstance(object_type, str)
        or not object_type
        or not isinstance(object_id, str)
        or not object_id
    ):
        return _diagnostic_result(
            result_kind="identity",
            mapping_status="error",
            reason_code="REVIEWED_OBJECT_IDENTIFIER_MISSING",
            source_concept="snapshot_review_identity",
            target_concept="snapshot_reviewed_object_identity",
            source_identity=source_identity,
            source_pointer=source_pointer,
        )
    declared_matches = [
        value for value in snapshot_objects.get(object_type, []) if value.get("id") == object_id
    ]
    other_matches = [
        value
        for kind, values in snapshot_objects.items()
        if kind != object_type
        for value in values
        if value.get("id") == object_id
    ]
    if len(declared_matches) > 1:
        status: MappingStatus = "error"
        reason = "REVIEWED_OBJECT_AMBIGUOUS"
    elif not declared_matches and other_matches:
        status = "error"
        reason = "REVIEWED_OBJECT_TYPE_MISMATCH"
    elif not declared_matches:
        status = "unresolved"
        reason = "REVIEWED_OBJECT_NOT_FOUND"
    else:
        target_identity: DiagnosticIdentity = {
            "jurisdiction": jurisdiction,
            "object_kind": f"snapshot_{object_type}",
            "id": object_id,
        }
        return _diagnostic_result(
            result_kind="identity",
            mapping_status="mapped",
            reason_code="REVIEWED_OBJECT_IDENTITY_EXACT",
            source_concept="snapshot_review_identity",
            target_concept="snapshot_reviewed_object_identity",
            source_identity=source_identity,
            target_identity=target_identity,
            source_pointer=source_pointer,
        )
    return _diagnostic_result(
        result_kind="identity",
        mapping_status=status,
        reason_code=reason,
        source_concept="snapshot_review_identity",
        target_concept="snapshot_reviewed_object_identity",
        source_identity=source_identity,
        source_pointer=source_pointer,
        unmapped_concepts=["snapshot_reviewed_object_identity"],
    )


def diagnostic_result_sort_key(result: DiagnosticResult) -> tuple[Any, ...]:
    """Sort by stable identity and finish with source/link coordinates."""

    source_identity = result["source_identity"]
    legacy_refs = source_identity.get("legacy_refs", [])
    stable_source_id = legacy_refs[0] if legacy_refs else source_identity.get("id", "")
    return (
        source_identity.get("jurisdiction", ""),
        stable_source_id,
        result["result_kind"],
        source_identity.get("object_kind", ""),
        result["source_concept"],
        result["target_concept"] or "",
        result["source_pointer"],
        result["passage_id"] or "",
        result["evidence_link_position"] if result["evidence_link_position"] is not None else -1,
    )


def build_evidence_diagnostic_projection(
    *, root: Path | None = None
) -> list[DiagnosticResult]:
    """Build an internal read-only compatibility diagnostic over frozen inputs.

    The result is not persisted, is not a native Writ record or Core schema, and is not consumed
    by corpus generation or mutation.
    """

    repo_root = root or find_repo_root()
    dataset = load_reviewed_input(root=repo_root)
    reviewed_claims = normalize_reviewed_claims(dataset)
    parent_by_id = {parent["row_id"]: parent for parent in dataset["records"]}
    parent_index = {parent["row_id"]: index for index, parent in enumerate(dataset["records"])}
    unresolved = _read_json(repo_root / UNRESOLVED_RELATIVE_PATH)
    unresolved_by_parent = {entry["row_id"]: (index, entry) for index, entry in enumerate(unresolved)}

    active_by_jurisdiction: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for jurisdiction, relative_dir in CORPUS_RELATIVE_DIRS.items():
        active_by_jurisdiction[jurisdiction] = {
            "claim": _read_yaml(repo_root / relative_dir / "records" / "claims.yaml")["claims"],
            "passage": _read_yaml(repo_root / relative_dir / "passages" / "passages.yaml")[
                "passages"
            ],
            "source": _read_yaml(repo_root / relative_dir / "sources" / "sources.yaml")[
                "sources"
            ],
        }

    results: list[DiagnosticResult] = []
    snapshot_claim_refs: set[str] = set()
    for jurisdiction in ("EU", "US"):
        snapshot_path = SNAPSHOT_RELATIVE_PATHS[jurisdiction]
        snapshot = _read_json_object(repo_root / snapshot_path)
        active = active_by_jurisdiction[jurisdiction]

        for index, document in enumerate(snapshot["document_versions"]):
            pointer = f"{snapshot_path.as_posix()}#/document_versions/{index}"
            results.append(
                resolve_snapshot_document_version_identity(
                    snapshot_document=document,
                    active_sources=active["source"],
                    jurisdiction=jurisdiction,
                    source_pointer=pointer,
                )
            )

        for index, passage in enumerate(snapshot["passages"]):
            pointer = f"{snapshot_path.as_posix()}#/passages/{index}"
            results.append(
                resolve_snapshot_passage_identity(
                    snapshot_passage=passage,
                    active_passages=active["passage"],
                    active_sources=active["source"],
                    jurisdiction=jurisdiction,
                    source_pointer=pointer,
                )
            )

        for index, claim in enumerate(snapshot["claims"]):
            pointer = f"{snapshot_path.as_posix()}#/claims/{index}"
            qualifiers = claim.get("qualifiers")
            legacy_ref = qualifiers.get("row_id") if isinstance(qualifiers, dict) else None
            if isinstance(legacy_ref, str):
                snapshot_claim_refs.add(legacy_ref)
            claim_identity: DiagnosticIdentity = {
                "jurisdiction": jurisdiction,
                "object_kind": "snapshot_claim",
                "id": str(claim.get("id", "")),
                "legacy_refs": [legacy_ref] if isinstance(legacy_ref, str) else [],
            }
            results.append(
                resolve_snapshot_claim_identity(
                    snapshot_claim=claim,
                    active_claims=active["claim"],
                    jurisdiction=jurisdiction,
                    source_pointer=pointer,
                )
            )
            results.append(
                project_explicit_semantic(
                    source_concept="truth_value",
                    value=claim.get("truth_value"),
                    source_identity=claim_identity,
                    source_pointer=f"{pointer}/truth_value",
                )
            )
            results.append(
                project_explicit_semantic(
                    source_concept="workflow_status",
                    value=claim.get("status"),
                    source_identity=claim_identity,
                    source_pointer=f"{pointer}/status",
                )
            )
            for link_position, evidence_link in enumerate(claim.get("evidence_links", [])):
                link_pointer = f"{pointer}/evidence_links/{link_position}"
                passage_id = evidence_link.get("passage_id")
                for concept in ("stance", "support_type"):
                    results.append(
                        project_explicit_semantic(
                            source_concept=concept,
                            value=evidence_link.get(concept),
                            source_identity=claim_identity,
                            source_pointer=f"{link_pointer}/{concept}",
                            passage_id=passage_id if isinstance(passage_id, str) else None,
                            evidence_link_position=link_position,
                        )
                    )

        snapshot_objects = {
            "claim": snapshot["claims"],
            "action": snapshot.get("actions", []),
        }
        for index, review in enumerate(snapshot["reviews"]):
            pointer = f"{snapshot_path.as_posix()}#/reviews/{index}"
            review_identity: DiagnosticIdentity = {
                "jurisdiction": jurisdiction,
                "object_kind": "snapshot_review",
                "id": str(review.get("id", "")),
            }
            results.append(
                resolve_snapshot_reviewed_object_identity(
                    snapshot_review=review,
                    snapshot_objects=snapshot_objects,
                    jurisdiction=jurisdiction,
                    source_pointer=pointer,
                )
            )
            results.append(
                project_explicit_semantic(
                    source_concept="snapshot_review_decision",
                    value=review.get("decision"),
                    source_identity=review_identity,
                    source_pointer=f"{pointer}/decision",
                )
            )

    for claim in reviewed_claims:
        claim_id = claim["claim_id"]
        parent_id = claim["parent_row_id"]
        parent = parent_by_id[parent_id]
        jurisdiction = claim["jurisdiction"]
        reviewed_claim_identity: DiagnosticIdentity = {
            "jurisdiction": jurisdiction,
            "object_kind": "reviewed_claim",
            "id": claim_id,
            "parent_id": parent_id,
            "legacy_refs": [claim_id],
        }
        parent_pointer = (
            f"{REVIEWED_RELATIVE_PATH.as_posix()}#/records/{parent_index[parent_id]}"
        )
        results.append(
            project_explicit_semantic(
                source_concept="reviewed_parent_decision",
                value=parent.get("review_decision"),
                source_identity=reviewed_claim_identity,
                source_pointer=f"{parent_pointer}/review_decision",
            )
        )
        if claim_id in snapshot_claim_refs:
            continue
        unresolved_match = unresolved_by_parent.get(parent_id)
        if unresolved_match is None:
            results.append(
                _diagnostic_result(
                    result_kind="identity",
                    mapping_status="error",
                    reason_code="UNRESOLVED_PROVENANCE_NOT_FOUND",
                    source_concept="evidence_identity",
                    target_concept="snapshot_evidence_identity",
                    source_identity=reviewed_claim_identity,
                    source_pointer=parent_pointer,
                )
            )
            continue
        unresolved_index, _ = unresolved_match
        results.append(
            _diagnostic_result(
                result_kind="identity",
                mapping_status="unresolved",
                reason_code="EVIDENCE_IDENTITY_NOT_AVAILABLE",
                source_concept="evidence_identity",
                target_concept="snapshot_evidence_identity",
                source_identity=reviewed_claim_identity,
                source_pointer=(
                    f"{UNRESOLVED_RELATIVE_PATH.as_posix()}#/{unresolved_index}"
                ),
                unmapped_concepts=[
                    "snapshot_claim_identity",
                    "snapshot_passage_identity",
                    "snapshot_document_version_identity",
                ],
            )
        )

    return sorted(results, key=diagnostic_result_sort_key)


def _claim_display_ref(claim: dict[str, Any]) -> str:
    label = CLAIM_REFS[claim["claim_id"]].split("#", 1)[1].replace("-", " ")
    return f"{claim['source_locator'].strip()} — {label}"


def _review_ref(parent: dict[str, Any], claims: list[dict[str, Any]]) -> str:
    first = next(claim for claim in claims if claim["parent_row_id"] == parent["row_id"])
    base = CLAIM_REFS[first["claim_id"]].split("#", 1)[0]
    return f"{base}#imported-review-group"


def _jurisdiction_entity(jurisdiction: str) -> dict[str, Any]:
    slug = "eu" if jurisdiction == "EU" else "us"
    name = "European Union" if jurisdiction == "EU" else "United States"
    return {
        **_identity(
            record_kind="entity",
            immutable_import_key=f"jurisdiction:{jurisdiction}",
            ref=f"{slug}/ai-governance/jurisdiction/{slug}#political-entity",
            display_ref=name,
            aliases=[jurisdiction],
        ),
        "record_type": "political_entity",
        "entity_type": "jurisdiction",
        "name": name,
        "jurisdiction": jurisdiction,
    }


def _claim_record(claim: dict[str, Any], review_id: str) -> dict[str, Any]:
    legacy_ref = claim["claim_id"]
    preserved = {
        key: copy.deepcopy(value)
        for key, value in claim.items()
        if key not in REMOVED_NORMALIZED_FIELDS
    }
    stage_one = (
        {"family": "legal_policy", "topics": ["artificial_intelligence"]}
        if claim["jurisdiction"] == "US"
        else {}
    )
    return {
        **_identity(
            record_kind="claim",
            immutable_import_key=legacy_ref,
            ref=CLAIM_REFS[legacy_ref],
            display_ref=_claim_display_ref(claim),
            legacy_refs=[legacy_ref],
        ),
        "record_type": "political_claim",
        "record_family": "policy",
        **stage_one,
        "review_status": "accepted",
        "imported_review_machine_id": review_id,
        **preserved,
    }


def _review_record(parent: dict[str, Any], claims: list[dict[str, Any]]) -> dict[str, Any]:
    parent_ref = parent["row_id"]
    grouped = [claim for claim in claims if claim["parent_row_id"] == parent_ref]
    legacy_refs = [parent_ref] if parent["record_type"] == "source_bundle" else []
    record = {
        **_identity(
            record_kind="review",
            immutable_import_key=f"parent:{parent_ref}",
            ref=_review_ref(parent, claims),
            display_ref=f"Imported review — {parent['source_locator'].strip()}",
            legacy_refs=legacy_refs,
        ),
        "record_type": "imported_parent_review",
        "jurisdiction": parent["jurisdiction"],
        "imported_parent_legacy_ref": parent_ref,
        "review_decision": parent["review_decision"],
        "original_record_type": parent["record_type"],
        "instrument": parent["instrument"],
        "source_locator": parent["source_locator"],
        "claim_machine_ids": [
            _machine_id("claim", claim["claim_id"]) for claim in grouped
        ],
    }
    if "interpretation_note" in parent:
        record["interpretation_note"] = copy.deepcopy(parent["interpretation_note"])
    return record


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _source_jurisdiction(
    document_version_id: str, passages: list[dict[str, Any]]
) -> str:
    matching = [
        passage["row_id"].split("-", 1)[0]
        for passage in passages
        if passage["document_version_id"] == document_version_id
    ]
    if not matching or len(set(matching)) != 1:
        raise CorpusMigrationError(
            f"cannot determine one jurisdiction for source {document_version_id}"
        )
    return matching[0]


def _source_record(
    document: dict[str, Any], jurisdiction: str
) -> dict[str, Any]:
    slug = jurisdiction.lower()
    old_id = document["id"]
    ref = (
        f"{slug}/ai-governance/{_slug(document['document_id'])}/"
        "official-document#source-version"
    )
    preserved = {key: copy.deepcopy(value) for key, value in document.items() if key != "id"}
    return {
        **_identity(
            record_kind="source",
            immutable_import_key=old_id,
            ref=ref,
            display_ref=document["title"],
            legacy_refs=[old_id],
        ),
        "record_type": "source_document_version",
        "jurisdiction": jurisdiction,
        "verification_status": "verified",
        **preserved,
    }


def _unresolved_source_record(
    unresolved: dict[str, Any], jurisdiction: str, claims: list[dict[str, Any]]
) -> dict[str, Any]:
    parent_ref = unresolved["row_id"]
    first = next(claim for claim in claims if claim["parent_row_id"] == parent_ref)
    base = CLAIM_REFS[first["claim_id"]].split("#", 1)[0]
    return {
        **_identity(
            record_kind="source",
            immutable_import_key=f"unresolved:{parent_ref}",
            ref=f"{base}#unresolved-source",
            display_ref=f"Unresolved source — {unresolved['source_locator'].strip()}",
        ),
        "record_type": "unresolved_source",
        "jurisdiction": jurisdiction,
        "verification_status": "unresolved",
        "imported_parent_legacy_ref": parent_ref,
        "instrument": unresolved["instrument"],
        "source_locator": unresolved["source_locator"],
        "reason": unresolved["reason"],
    }


def _unresolved_coverage_record(
    unresolved: dict[str, Any], jurisdiction: str, claims: list[dict[str, Any]]
) -> dict[str, Any]:
    parent_ref = unresolved["row_id"]
    first = next(claim for claim in claims if claim["parent_row_id"] == parent_ref)
    base = CLAIM_REFS[first["claim_id"]].split("#", 1)[0]
    return {
        **_identity(
            record_kind="coverage",
            immutable_import_key=f"unresolved:{parent_ref}",
            ref=f"{base}#missing-source-coverage",
            display_ref=f"Missing source coverage — {unresolved['source_locator'].strip()}",
        ),
        "record_type": "coverage_record",
        "jurisdiction": jurisdiction,
        "coverage_status": "unresolved",
        "source_machine_id": _machine_id("source", f"unresolved:{parent_ref}"),
        "imported_parent_legacy_ref": parent_ref,
        "instrument": unresolved["instrument"],
        "source_locator": unresolved["source_locator"],
        "reason": unresolved["reason"],
    }


def _passage_record(
    passage: dict[str, Any],
    jurisdiction: str,
    claims: list[dict[str, Any]],
) -> dict[str, Any]:
    imported_ref = passage["row_id"]
    matching = [
        claim
        for claim in claims
        if claim["claim_id"] == imported_ref or claim["parent_row_id"] == imported_ref
    ]
    if not matching:
        raise CorpusMigrationError(f"passage {passage['id']} has no reviewed claim")
    first = matching[0]
    base = CLAIM_REFS[first["claim_id"]].split("#", 1)[0]
    old_id = passage["id"]
    preserved = {
        key: copy.deepcopy(value)
        for key, value in passage.items()
        if key not in {"id", "row_id", "document_version_id"}
    }
    return {
        **_identity(
            record_kind="passage",
            immutable_import_key=old_id,
            ref=f"{base}#source-passage",
            display_ref=f"Source passage — {first['source_locator'].strip()}",
            legacy_refs=[old_id],
        ),
        "record_type": "source_passage",
        "jurisdiction": jurisdiction,
        "source_machine_id": _machine_id("source", passage["document_version_id"]),
        "imported_source_legacy_ref": imported_ref,
        **preserved,
    }


def _relationship(
    *,
    jurisdiction: str,
    claim: dict[str, Any],
    relation_type: str,
    target_machine_id: str,
    target_type: str,
) -> dict[str, Any]:
    legacy_ref = claim["claim_id"]
    claim_id = _machine_id("claim", legacy_ref)
    label = CLAIM_REFS[legacy_ref].split("#", 1)[1]
    base = CLAIM_REFS[legacy_ref].split("#", 1)[0]
    return {
        **_identity(
            record_kind="relationship",
            immutable_import_key=(
                f"{relation_type}:{claim_id}:{target_machine_id}"
            ),
            ref=f"{base}#{label}-{relation_type.replace('_', '-')}",
            display_ref=f"{label.replace('-', ' ')} — {relation_type.replace('_', ' ')}",
        ),
        "record_type": "relationship",
        "jurisdiction": jurisdiction,
        "relationship_type": relation_type,
        "subject_machine_id": claim_id,
        "subject_type": "claim",
        "object_machine_id": target_machine_id,
        "object_type": target_type,
    }


def _build_relationships(
    jurisdiction: str,
    claims: list[dict[str, Any]],
    passages: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    entity_id = _machine_id("entity", f"jurisdiction:{jurisdiction}")
    passage_by_claim: dict[str, str] = {}
    for passage in passages:
        imported_ref = passage["row_id"]
        direct = [claim for claim in claims if claim["claim_id"] == imported_ref]
        matching = direct or [
            claim for claim in claims if claim["parent_row_id"] == imported_ref
        ]
        for claim in matching:
            passage_by_claim[claim["claim_id"]] = _machine_id(
                "passage", passage["id"]
            )
    relationships: list[dict[str, Any]] = []
    for claim in claims:
        relationships.append(
            _relationship(
                jurisdiction=jurisdiction,
                claim=claim,
                relation_type="in_jurisdiction",
                target_machine_id=entity_id,
                target_type="entity",
            )
        )
        relationships.append(
            _relationship(
                jurisdiction=jurisdiction,
                claim=claim,
                relation_type="reviewed_under_parent",
                target_machine_id=_machine_id(
                    "review", f"parent:{claim['parent_row_id']}"
                ),
                target_type="review",
            )
        )
        passage_id = passage_by_claim.get(claim["claim_id"])
        if passage_id is not None:
            relationships.append(
                _relationship(
                    jurisdiction=jurisdiction,
                    claim=claim,
                    relation_type="supported_by_passage",
                    target_machine_id=passage_id,
                    target_type="passage",
                )
            )
    return relationships


def _migration_map(
    jurisdiction: str,
    all_parents: list[dict[str, Any]],
    claims: list[dict[str, Any]],
    reconciliation: dict[str, Any],
) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    for global_index, parent in enumerate(all_parents):
        if parent["jurisdiction"] != jurisdiction:
            continue
        parent_ref = parent["row_id"]
        grouped = [claim for claim in claims if claim["parent_row_id"] == parent_ref]
        if parent["record_type"] == "source_bundle":
            review_ref = _review_ref(parent, claims)
            entries.append(
                {
                    "legacy_ref": parent_ref,
                    "target_record_type": "review",
                    "machine_id": _machine_id("review", f"parent:{parent_ref}"),
                    "ref": review_ref,
                    "active_file": "reviews/parent-annotations.yaml",
                    "archive_pointer": (
                        f"original/annotations/human-reviewed.yaml#/records/{global_index}"
                    ),
                }
            )
            for child_index, claim in enumerate(grouped):
                legacy_ref = claim["claim_id"]
                entries.append(
                    {
                        "legacy_ref": legacy_ref,
                        "target_record_type": "claim",
                        "machine_id": _machine_id("claim", legacy_ref),
                        "ref": CLAIM_REFS[legacy_ref],
                        "active_file": "records/claims.yaml",
                        "archive_pointer": (
                            "original/annotations/human-reviewed.yaml"
                            f"#/records/{global_index}/derived_claims/{child_index}"
                        ),
                    }
                )
        else:
            entries.append(
                {
                    "legacy_ref": parent_ref,
                    "target_record_type": "claim",
                    "machine_id": _machine_id("claim", parent_ref),
                    "ref": CLAIM_REFS[parent_ref],
                    "active_file": "records/claims.yaml",
                    "archive_pointer": (
                        f"original/annotations/human-reviewed.yaml#/records/{global_index}"
                    ),
                }
            )

    document = {
        "schema_version": "1.0.0",
        "jurisdiction": jurisdiction,
        "identity_namespace": IDENTITY_NAMESPACE_URN,
        "identity_derivation": IDENTITY_DERIVATION,
        "entries": entries,
    }
    if jurisdiction == "EU":
        document["excluded_temporary_assignments"] = copy.deepcopy(
            reconciliation["removed_from_main_reviewed_corpus"]
        )
        document["corrected_numbering"] = copy.deepcopy(
            reconciliation["corrected_numbering"]
        )
    return document


def build_corpus_documents(*, root: Path | None = None) -> dict[Path, dict[str, Any]]:
    """Build every active corpus YAML document from the hash-pinned review input."""
    repo_root = root or find_repo_root()
    dataset = load_reviewed_input(root=repo_root)
    claims = normalize_reviewed_claims(dataset)
    documents = _read_json(repo_root / DOCUMENT_VERSIONS_RELATIVE_PATH)
    passages = _read_json(repo_root / PASSAGES_RELATIVE_PATH)
    unresolved = _read_json(repo_root / UNRESOLVED_RELATIVE_PATH)

    output: dict[Path, dict[str, Any]] = {}
    for jurisdiction, relative_dir in CORPUS_RELATIVE_DIRS.items():
        jurisdiction_claims = [
            claim for claim in claims if claim["jurisdiction"] == jurisdiction
        ]
        jurisdiction_parents = [
            parent
            for parent in dataset["records"]
            if parent["jurisdiction"] == jurisdiction
        ]
        jurisdiction_passages = [
            passage
            for passage in passages
            if passage["row_id"].startswith(f"{jurisdiction}-")
        ]
        jurisdiction_documents = [
            document
            for document in documents
            if _source_jurisdiction(document["id"], passages) == jurisdiction
        ]
        jurisdiction_unresolved = [
            item
            for item in unresolved
            if item["row_id"].startswith(f"{jurisdiction}-")
        ]
        reviews = [
            _review_record(parent, jurisdiction_claims)
            for parent in jurisdiction_parents
        ]
        review_by_parent = {
            review["imported_parent_legacy_ref"]: review["machine_id"]
            for review in reviews
        }
        claim_records = [
            _claim_record(claim, review_by_parent[claim["parent_row_id"]])
            for claim in jurisdiction_claims
        ]
        source_records = [
            _source_record(document, jurisdiction)
            for document in jurisdiction_documents
        ]
        source_records.extend(
            _unresolved_source_record(item, jurisdiction, jurisdiction_claims)
            for item in jurisdiction_unresolved
        )
        passage_records = [
            _passage_record(passage, jurisdiction, jurisdiction_claims)
            for passage in jurisdiction_passages
        ]
        relationships = _build_relationships(
            jurisdiction, jurisdiction_claims, jurisdiction_passages
        )
        entity = _jurisdiction_entity(jurisdiction)
        migration_map = _migration_map(
            jurisdiction,
            dataset["records"],
            jurisdiction_claims,
            dataset["reconciliation"],
        )

        output[relative_dir / "corpus.yaml"] = {
            "schema_version": "1.0.0",
            "corpus_id": f"writ.corpus.{jurisdiction.lower()}.ai-governance",
            "title": (
                "European Union AI governance"
                if jurisdiction == "EU"
                else "United States AI governance"
            ),
            "jurisdiction": jurisdiction,
            "field": "ai-governance",
            "status": "active",
            "identity_namespace": IDENTITY_NAMESPACE_URN,
            "identity_adr": "adr/0014-stable-corpus-identities.md",
            "record_counts": {
                "sources": len(source_records),
                "verified_source_documents": len(jurisdiction_documents),
                "unresolved_sources": len(jurisdiction_unresolved),
                "passages": len(passage_records),
                "entities": 1,
                "claims": len(claim_records),
                "relationships": len(relationships),
                "imported_parent_reviews": len(reviews),
                "legacy_mappings": len(migration_map["entries"]),
            },
            "files": {
                "sources": "sources/sources.yaml",
                "passages": "passages/passages.yaml",
                "unresolved_passages": "passages/unresolved.yaml",
                "entities": "records/entities.yaml",
                "claims": "records/claims.yaml",
                "relationships": "records/relationships.yaml",
                "reviews": "reviews/parent-annotations.yaml",
                "reconciliation": "reviews/reconciliation.yaml",
                "migration_map": "migration-map.yaml",
            },
        }
        output[relative_dir / "sources" / "sources.yaml"] = {
            "schema_version": "1.0.0",
            "jurisdiction": jurisdiction,
            "sources": source_records,
        }
        output[relative_dir / "passages" / "passages.yaml"] = {
            "schema_version": "1.0.0",
            "jurisdiction": jurisdiction,
            "passages": passage_records,
        }
        output[relative_dir / "passages" / "unresolved.yaml"] = {
            "schema_version": "1.0.0",
            "jurisdiction": jurisdiction,
            "unresolved": [
                _unresolved_coverage_record(item, jurisdiction, jurisdiction_claims)
                for item in jurisdiction_unresolved
            ],
        }
        output[relative_dir / "records" / "entities.yaml"] = {
            "schema_version": "1.0.0",
            "jurisdiction": jurisdiction,
            "entities": [entity],
        }
        output[relative_dir / "records" / "claims.yaml"] = {
            "schema_version": "1.0.0",
            "jurisdiction": jurisdiction,
            "claims": claim_records,
        }
        output[relative_dir / "records" / "relationships.yaml"] = {
            "schema_version": "1.0.0",
            "jurisdiction": jurisdiction,
            "relationships": relationships,
        }
        output[relative_dir / "reviews" / "parent-annotations.yaml"] = {
            "schema_version": "1.0.0",
            "jurisdiction": jurisdiction,
            "reviews": reviews,
        }
        output[relative_dir / "reviews" / "reconciliation.yaml"] = {
            "schema_version": "1.0.0",
            "jurisdiction": jurisdiction,
            "row_order_authority": dataset["reconciliation"]["row_order_authority"],
            "removed_from_reviewed_corpus": (
                copy.deepcopy(
                    dataset["reconciliation"]["removed_from_main_reviewed_corpus"]
                )
                if jurisdiction == "EU"
                else []
            ),
            "corrected_numbering": (
                copy.deepcopy(dataset["reconciliation"]["corrected_numbering"])
                if jurisdiction == "EU"
                else []
            ),
        }
        output[relative_dir / "migration-map.yaml"] = migration_map
    return output


def canonical_yaml_bytes(value: dict[str, Any]) -> bytes:
    return yaml.safe_dump(
        value,
        allow_unicode=True,
        sort_keys=False,
        width=100,
    ).encode("utf-8")


def write_corpus_documents(*, root: Path | None = None, check: bool = False) -> None:
    repo_root = root or find_repo_root()
    for relative_path, value in build_corpus_documents(root=repo_root).items():
        path = repo_root / relative_path
        expected = canonical_yaml_bytes(value)
        if check:
            if not path.is_file() or path.read_bytes() != expected:
                raise CorpusMigrationError(f"generated corpus file has drifted: {relative_path}")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(expected)


def _walk(value: Any):
    yield value
    if isinstance(value, dict):
        for child in value.values():
            yield from _walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk(child)


def validate_active_corpora(*, root: Path | None = None) -> dict[str, int]:
    repo_root = root or find_repo_root()
    write_corpus_documents(root=repo_root, check=True)
    totals = {
        "eu_parent_reviews": 0,
        "us_parent_reviews": 0,
        "eu_claims": 0,
        "us_claims": 0,
        "legacy_mappings": 0,
        "passages": 0,
        "verified_sources": 0,
        "unknown_values": 0,
    }
    for jurisdiction, relative_dir in CORPUS_RELATIVE_DIRS.items():
        corpus = _read_yaml(repo_root / relative_dir / "corpus.yaml")
        claims = _read_yaml(repo_root / relative_dir / "records" / "claims.yaml")[
            "claims"
        ]
        reviews = _read_yaml(
            repo_root / relative_dir / "reviews" / "parent-annotations.yaml"
        )["reviews"]
        relationships = _read_yaml(
            repo_root / relative_dir / "records" / "relationships.yaml"
        )["relationships"]
        migration = _read_yaml(repo_root / relative_dir / "migration-map.yaml")
        passages = _read_yaml(
            repo_root / relative_dir / "passages" / "passages.yaml"
        )["passages"]
        sources = _read_yaml(repo_root / relative_dir / "sources" / "sources.yaml")[
            "sources"
        ]
        entities = _read_yaml(
            repo_root / relative_dir / "records" / "entities.yaml"
        )["entities"]
        unresolved = _read_yaml(
            repo_root / relative_dir / "passages" / "unresolved.yaml"
        )["unresolved"]

        if any(
            forbidden in node
            for document in (
                corpus,
                claims,
                reviews,
                relationships,
                passages,
                sources,
                entities,
                unresolved,
            )
            for node in _walk(document)
            if isinstance(node, dict)
            for forbidden in FORBIDDEN_ACTIVE_KEYS
        ):
            raise CorpusMigrationError(
                f"{jurisdiction} active corpus contains a retired comparative field"
            )
        for collection in (
            claims,
            reviews,
            relationships,
            passages,
            sources,
            entities,
            unresolved,
        ):
            for record in collection:
                missing = [field for field in IDENTITY_FIELDS if field not in record]
                if missing:
                    raise CorpusMigrationError(
                        f"{jurisdiction} record missing identity fields {missing}"
                    )
                if re.search(r"(?:EU|US)-\\d{2}", record["ref"], re.IGNORECASE):
                    raise CorpusMigrationError(
                        f"active ref encodes spreadsheet order: {record['ref']}"
                    )
        for relation in relationships:
            if not relation["subject_machine_id"] or not relation["object_machine_id"]:
                raise CorpusMigrationError("relationship endpoint is not a machine_id")
            if "subject_ref" in relation or "object_ref" in relation:
                raise CorpusMigrationError("relationship depends on a readable ref")

        legacy_refs = [entry["legacy_ref"] for entry in migration["entries"]]
        if len(legacy_refs) != len(set(legacy_refs)):
            raise CorpusMigrationError(
                f"{jurisdiction} migration map contains duplicate legacy refs"
            )

        prefix = jurisdiction.lower()
        totals[f"{prefix}_parent_reviews"] = len(reviews)
        totals[f"{prefix}_claims"] = len(claims)
        totals["legacy_mappings"] += len(legacy_refs)
        totals["passages"] += len(passages)
        totals["verified_sources"] += sum(
            source["verification_status"] == "verified" for source in sources
        )
        totals["unknown_values"] += sum(
            claim.get("enforcement_status") == "unknown" for claim in claims
        )
    return totals
