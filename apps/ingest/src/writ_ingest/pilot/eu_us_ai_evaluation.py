"""The human-reviewed EU-US AI evaluation pilot: normalization, derivation, validation.

The pilot answers one question: does the jurisdiction currently impose a binding
model-evaluation requirement on providers of advanced or general-purpose AI models?

Everything here is pure and deterministic. Nothing reads the clock or the network,
nothing mutates its inputs, and nothing infers a value the reviewer did not record.
The reviewed annotation table is the authority for row identity; source order never
renumbers a row.
"""

from __future__ import annotations

import copy
import json
from collections import Counter
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator, FormatChecker

from writ_ingest.corpus.registry import find_repo_root

PILOT_RELATIVE_DIR = Path("pilot/eu-us-ai-evaluation")
DATASET_RELATIVE_PATH = PILOT_RELATIVE_DIR / "annotations" / "human-reviewed.yaml"
SCHEMA_RELATIVE_DIR = PILOT_RELATIVE_DIR / "schemas"
NORMALIZED_RELATIVE_DIR = PILOT_RELATIVE_DIR / "normalized"

PARSER_VERSION = "eu-us-ai-evaluation-pilot@1.0.0"
DERIVED_SCHEMA_VERSION = "1.0.0"

SCHEMA_FILES = {
    "reviewed_dataset": "reviewed_dataset.schema.json",
    "normalized_claim": "normalized_claim.schema.json",
    "headline_judgments": "headline_judgments.schema.json",
}

# Row identity comes from the uploaded annotation table, not from source order.
EXPECTED_ROW_IDS: tuple[str, ...] = tuple(f"EU-{index:02d}" for index in range(1, 13)) + tuple(
    f"US-{index:02d}" for index in range(1, 13)
)

# Passages that were wrongly given EU-06 and EU-07 identifiers in an earlier draft.
# They are not EU-06 and EU-07 in the reviewed table and must not occupy any EU row.
REMOVED_TEMPORARY_LOCATORS: dict[str, str] = {
    "EU-06": "Article 51(1)-(2)",
    "EU-07": "Article 52(1)",
}

# The corrected Article 55(1) numbering the review restored.
CORRECTED_ARTICLE_55_NUMBERING: dict[str, str] = {
    "Article 55(1)(a)": "EU-06",
    "Article 55(1)(b)": "EU-07",
    "Article 55(1)(c)": "EU-08",
    "Article 55(1)(d)": "EU-09",
}

# Every EU statutory locator and the row it occupies, so a renumbering cannot pass quietly.
EU_LOCATOR_TO_ROW: dict[str, str] = {
    "Article 53(1)(a)": "EU-01",
    "Article 53(1)(b)": "EU-02",
    "Article 53(1)(c)": "EU-03",
    "Article 53(1)(d)": "EU-04",
    "Article 53(2)": "EU-05",
    **CORRECTED_ARTICLE_55_NUMBERING,
}

ALLOWED_ADOPTION_STATUS = frozenset({"adopted", "proposed"})
ALLOWED_APPLICABILITY_STATUS = frozenset(
    {
        "applicable",
        "contingent_on_contract",
        "draft_available",
        "not_yet_applicable",
        "transition_for_existing_models",
    }
)
ALLOWED_ENFORCEMENT_STATUS = frozenset(
    {
        "contractual_enforcement",
        "internal_executive_implementation",
        "internal_government_implementation",
        "not_applicable",
        "not_determinable_from_passage",
        "unknown",
    }
)
LIFECYCLE_FIELDS = ("adoption_status", "applicability_status", "enforcement_status")

# The reviewed set of claims whose conduct actually is model evaluation. Documentation,
# risk assessment, monitoring, reporting, and testing access are deliberately excluded.
MODEL_EVALUATION_CLAIM_IDS = frozenset({"EU-06", "US-03", "US-05A", "US-05B"})

# Every reviewed value, pinned per field as a claim-id partition. This is what makes a
# schema-valid but semantically wrong edit fail: relabelling an actor, promoting voluntary
# guidance to binding, or recoding `unknown` all move a claim between buckets. The
# `__absent__` bucket records where the reviewer stated no value, so a field cannot be
# invented for a claim that never carried one.
ABSENT = "__absent__"

REVIEWED_FIELD_PARTITIONS: dict[str, dict[str, frozenset[str]]] = {
    "legal_force": {
        "binding": frozenset(
            {
                "EU-01", "EU-02", "EU-03", "EU-04", "EU-05", "EU-06", "EU-07", "EU-08",
                "EU-09", "EU-10B", "EU-11A", "EU-11B", "US-06", "US-07", "US-08A", "US-08B",
                "US-09A", "US-09B"
            }
        ),
        "contractual": frozenset({"US-09C", "US-10A", "US-10B"}),
        "interpretive": frozenset({"EU-10A"}),
        "mixed": frozenset({"US-12"}),
        "proposed": frozenset({"US-11"}),
        "voluntary": frozenset(
            {
                "EU-10C", "EU-12", "US-01", "US-02", "US-03", "US-04", "US-05A", "US-05B"
            }
        ),
    },
    "adoption_status": {
        "adopted": frozenset(
            {
                "EU-01", "EU-02", "EU-03", "EU-04", "EU-05", "EU-06", "EU-07", "EU-08",
                "EU-09", "EU-10A", "EU-10B", "EU-10C", "EU-11A", "EU-11B", "EU-12", "US-01",
                "US-02", "US-03", "US-04", "US-05A", "US-06", "US-07", "US-08A", "US-08B",
                "US-09A", "US-09B", "US-09C", "US-10A", "US-10B", "US-12"
            }
        ),
        "proposed": frozenset({"US-05B", "US-11"}),
    },
    "applicability_status": {
        "applicable": frozenset(
            {
                "EU-01", "EU-02", "EU-03", "EU-04", "EU-05", "EU-06", "EU-07", "EU-08",
                "EU-09", "EU-10A", "EU-10B", "EU-10C", "EU-11A", "EU-12", "US-01", "US-02",
                "US-03", "US-04", "US-05A", "US-06", "US-07", "US-08A", "US-08B", "US-09A",
                "US-09B", "US-12"
            }
        ),
        "contingent_on_contract": frozenset({"US-09C", "US-10A", "US-10B"}),
        "draft_available": frozenset({"US-05B"}),
        "not_yet_applicable": frozenset({"US-11"}),
        "transition_for_existing_models": frozenset({"EU-11B"}),
    },
    "enforcement_status": {
        "contractual_enforcement": frozenset({"US-09C", "US-10A", "US-10B"}),
        "internal_executive_implementation": frozenset({"US-06"}),
        "internal_government_implementation": frozenset(
            {
                "US-07", "US-08A", "US-08B", "US-09A", "US-09B"
            }
        ),
        "not_applicable": frozenset(
            {
                "EU-10A", "EU-10C", "EU-12", "US-01", "US-02", "US-03", "US-04", "US-05A",
                "US-05B", "US-11"
            }
        ),
        "not_determinable_from_passage": frozenset({"US-12"}),
        "unknown": frozenset(
            {
                "EU-01", "EU-02", "EU-03", "EU-04", "EU-05", "EU-06", "EU-07", "EU-08",
                "EU-09", "EU-10B", "EU-11A", "EU-11B"
            }
        ),
    },
    "actor_type": {
        "__absent__": frozenset({"EU-11A", "EU-11B", "US-11"}),
        "ai_lifecycle_organization": frozenset(
            {
                "US-01", "US-02", "US-03", "US-04", "US-05A", "US-05B"
            }
        ),
        "federal_agency": frozenset(
            {
                "US-06", "US-07", "US-08A", "US-08B", "US-09A", "US-09B", "US-12"
            }
        ),
        "government_vendor": frozenset({"US-09C", "US-10A", "US-10B"}),
        "market_provider": frozenset(
            {
                "EU-01", "EU-02", "EU-03", "EU-04", "EU-05", "EU-06", "EU-07", "EU-08",
                "EU-09", "EU-10A", "EU-10B", "EU-10C", "EU-12"
            }
        ),
    },
    "binding_scope": {
        "__absent__": frozenset(
            {
                "EU-01", "EU-02", "EU-03", "EU-04", "EU-05", "EU-06", "EU-07", "EU-08",
                "EU-09", "EU-10A", "EU-10B", "EU-10C", "EU-11A", "EU-11B", "EU-12", "US-01",
                "US-02", "US-03", "US-04", "US-05A", "US-05B", "US-11", "US-12"
            }
        ),
        "executive_branch_only": frozenset({"US-06"}),
        "federal_agencies_only": frozenset({"US-07", "US-08A", "US-08B", "US-09A", "US-09B"}),
        "government_contract_only": frozenset({"US-09C", "US-10A", "US-10B"}),
    },
    "conduct_type": {
        "__absent__": frozenset({"EU-05", "EU-11A", "EU-11B", "US-07"}),
        "administrative_policy_revision": frozenset({"US-06"}),
        "compliance_demonstration": frozenset({"EU-10C", "EU-12"}),
        "contract_documentation": frozenset({"US-10A"}),
        "contract_terms_requirement": frozenset({"US-09B"}),
        "copyright_policy": frozenset({"EU-03"}),
        "cybersecurity_protection": frozenset({"EU-09"}),
        "downstream_documentation": frozenset({"EU-02"}),
        "evaluation_access": frozenset({"US-09C"}),
        "evaluation_documentation": frozenset({"EU-01"}),
        "evaluation_infrastructure_coordination": frozenset({"US-12"}),
        "evaluation_participation": frozenset({"US-04"}),
        "incident_reporting": frozenset({"EU-08"}),
        "model_evaluation": frozenset({"EU-06", "US-03", "US-05A", "US-05B"}),
        "monitoring_support": frozenset({"US-10B"}),
        "pre_deployment_testing": frozenset({"US-08A"}),
        "procurement_testing": frozenset({"US-09A"}),
        "regulatory_classification": frozenset({"EU-10A"}),
        "regulatory_notification": frozenset({"EU-10B"}),
        "reporting_and_disclosure": frozenset({"US-11"}),
        "risk_assessment": frozenset({"EU-07", "US-08B"}),
        "risk_management": frozenset({"US-01", "US-02"}),
        "training_content_summary": frozenset({"EU-04"}),
    },
    "compliance_function": {
        "__absent__": frozenset({"EU-11A", "EU-11B", "US-07"}),
        "agency_policy_direction": frozenset({"US-06"}),
        "contract_condition_creation": frozenset({"US-09B"}),
        "direct_obligation": frozenset(
            {
                "EU-01", "EU-02", "EU-03", "EU-04", "EU-06", "EU-07", "EU-08", "EU-09",
                "EU-10B", "US-08A", "US-08B", "US-09A"
            }
        ),
        "evaluation_collaboration": frozenset({"US-04"}),
        "evaluation_guidance": frozenset({"US-03", "US-05A", "US-05B"}),
        "general_guidance": frozenset({"US-01"}),
        "implementation_guidance": frozenset({"EU-10A", "US-02"}),
        "obligation_exception": frozenset({"EU-05"}),
        "policy_direction": frozenset({"US-12"}),
        "procurement_contract_obligation": frozenset({"US-09C", "US-10A", "US-10B"}),
        "prospective_regulatory_requirement": frozenset({"US-11"}),
        "recognized_compliance_path": frozenset({"EU-10C", "EU-12"}),
    },
}

ENFORCEMENT_PARTITION = REVIEWED_FIELD_PARTITIONS["enforcement_status"]
LEGAL_FORCE_PARTITION = REVIEWED_FIELD_PARTITIONS["legal_force"]
UNKNOWN_ENFORCEMENT_CLAIM_IDS = ENFORCEMENT_PARTITION["unknown"]

# Claims that record no duty-bearing actor at all. EU-11A/B are lifecycle rules carrying
# `target_actor`; US-11 is a proposal carrying `current_actor_type` and
# `prospective_actor_type`. None of those fields may stand in for `actor_type`.
CLAIMS_WITHOUT_ACTOR_TYPE = frozenset({"EU-11A", "EU-11B", "US-11"})

# Claims carrying `conduct_family: evaluation`, with the conduct they actually record.
# A federal agency testing a system it will use or buy is not a provider evaluating a model.
CONDUCT_FAMILY_EVALUATION_CONDUCT: dict[str, str] = {
    "US-08A": "pre_deployment_testing",
    "US-09A": "procurement_testing",
}

GOVERNMENT_ONLY_BINDING_SCOPES = frozenset({"federal_agencies_only", "government_contract_only"})

# Bundle-level context a child claim inherits. A child may override `instrument`.
INHERITED_FROM_PARENT = ("jurisdiction", "instrument", "source_locator", "interpretation_note")

_PARENT_TABLE_FIELDS = frozenset({"row_id", "review_decision", "record_type", "derived_claims"})
_CHILD_TABLE_FIELDS = frozenset({"claim_id", "record_type"})

# Headline predicate: a binding, currently applicable model-evaluation duty on a market provider.
HEADLINE_RULE: dict[str, str] = {
    "legal_force": "binding",
    "applicability_status": "applicable",
    "actor_type": "market_provider",
    "conduct_type": "model_evaluation",
}

_EU_SUPPORTING_RELEVANCE = frozenset(
    {"supporting_only", "scope_activation_support", "establishes_current_applicability"}
)
_EU_QUALIFYING_RELEVANCE = frozenset({"qualifies_current_applicability"})


class PilotValidationError(ValueError):
    """One or more reviewed pilot records, claims, or judgments are invalid."""


def _collapse(text: str) -> str:
    """Collapse folded-scalar whitespace for comparison only; stored data stays verbatim."""
    return " ".join(text.split())


def load_pilot_schema(kind: str, *, root: Path | None = None) -> dict[str, Any]:
    if kind not in SCHEMA_FILES:
        raise PilotValidationError(f"unknown pilot schema kind: {kind}")
    repo_root = root or find_repo_root()
    path = repo_root / SCHEMA_RELATIVE_DIR / SCHEMA_FILES[kind]
    value: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return value


def validate_pilot_record(kind: str, record: dict[str, Any], *, root: Path | None = None) -> None:
    """Validate one record against its pilot contract."""
    schema = load_pilot_schema(kind, root=root)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(record), key=lambda item: list(item.absolute_path))
    if errors:
        details = "; ".join(
            f"/{'/'.join(str(part) for part in error.absolute_path)}: {error.message}"
            for error in errors[:20]
        )
        raise PilotValidationError(f"invalid {kind} record: {details}")


def load_reviewed_dataset(path: Path | None = None) -> dict[str, Any]:
    """Load the authoritative human-reviewed annotation table."""
    dataset_path = path or find_repo_root() / DATASET_RELATIVE_PATH
    try:
        parsed = yaml.safe_load(dataset_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise PilotValidationError(f"reviewed pilot dataset is missing: {dataset_path}") from exc
    if not isinstance(parsed, dict):
        raise PilotValidationError("reviewed pilot dataset must be a mapping")
    return parsed


def source_claim_units(dataset: dict[str, Any]) -> list[tuple[str, str, dict[str, Any]]]:
    """Return `(claim_id, parent_row_id, source_payload)` for every claim in the table.

    A leaf row is one claim. A source bundle is one claim per child. Bundles and their
    children are never merged, and a bundle never collapses into a single claim.
    """
    units: list[tuple[str, str, dict[str, Any]]] = []
    for record in dataset["records"]:
        row_id = record["row_id"]
        if record["record_type"] == "source_bundle":
            for child in record["derived_claims"]:
                units.append((child["claim_id"], row_id, child))
        else:
            units.append((row_id, row_id, record))
    return units


def normalize_claims(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    """Generate the normalized claims from the reviewed parent records.

    Every reviewed field is copied verbatim. No field is defaulted, inferred, filled in,
    or merged with another, and `unknown` is carried through unchanged.
    """
    claims: list[dict[str, Any]] = []
    for record in dataset["records"]:
        if record["record_type"] == "source_bundle":
            claims.extend(_claim_from_child(record, child) for child in record["derived_claims"])
        else:
            claims.append(_claim_from_parent(record))
    return claims


def _envelope(claim_id: str, parent_row_id: str, origin: str, record_type: str) -> dict[str, Any]:
    return {
        "schema_version": DERIVED_SCHEMA_VERSION,
        "record_type": "pilot_normalized_claim",
        "parser_version": PARSER_VERSION,
        "claim_id": claim_id,
        "parent_row_id": parent_row_id,
        "claim_origin": origin,
        "claim_record_type": record_type,
    }


def _claim_from_parent(record: dict[str, Any]) -> dict[str, Any]:
    claim = _envelope(record["row_id"], record["row_id"], "parent_record", record["record_type"])
    for key, value in record.items():
        if key not in _PARENT_TABLE_FIELDS:
            claim[key] = copy.deepcopy(value)
    return dict(sorted(claim.items()))


def _claim_from_child(parent: dict[str, Any], child: dict[str, Any]) -> dict[str, Any]:
    claim = _envelope(child["claim_id"], parent["row_id"], "derived_claim", child["record_type"])
    for key in INHERITED_FROM_PARENT:
        if key in parent:
            claim[key] = copy.deepcopy(parent[key])
    for key, value in child.items():
        if key not in _CHILD_TABLE_FIELDS:
            claim[key] = copy.deepcopy(value)
    return dict(sorted(claim.items()))


def satisfies_headline_rule(claim: dict[str, Any]) -> bool:
    """Whether a claim establishes a binding, applicable model-evaluation duty on a provider.

    All four conditions are conjunctive. A claim carrying `conduct_family: evaluation`
    but a different `conduct_type` does not satisfy the rule: pre-deployment testing and
    procurement testing are not model evaluation. A binding norm whose `binding_scope`
    limits it to agencies or contracts is excluded because its actor is not a market provider.
    """
    return all(claim.get(field) == value for field, value in HEADLINE_RULE.items())


def derive_headline_judgments(claims: list[dict[str, Any]]) -> dict[str, Any]:
    """Derive the headline judgments from the claims. Evidence lists are never hardcoded."""
    eu = [claim for claim in claims if claim["jurisdiction"] == "EU"]
    us = [claim for claim in claims if claim["jurisdiction"] == "US"]

    eu_decisive = [claim for claim in eu if satisfies_headline_rule(claim)]
    eu_defined_class = (
        _collapse(eu_decisive[0]["actor_term_local"])
        if eu_decisive and "actor_term_local" in eu_decisive[0]
        else None
    )
    us_decisive = [claim for claim in us if satisfies_headline_rule(claim)]

    voluntary_cross_sector = _ids(
        us,
        lambda claim: claim["legal_force"] == "voluntary"
        and claim["adoption_status"] == "adopted"
        and "cross_sector" in claim.get("scope", []),
    )
    government_use = _ids(
        us,
        lambda claim: claim["legal_force"] == "binding"
        and claim.get("binding_scope") == "federal_agencies_only"
        and "government_use" in claim.get("scope", []),
    )
    procurement = _ids(
        us,
        lambda claim: claim["legal_force"] == "binding"
        and claim.get("binding_scope") == "federal_agencies_only"
        and "government_procurement" in claim.get("scope", []),
    )
    contract_mediated = _ids(
        us,
        lambda claim: claim["legal_force"] == "contractual"
        and claim.get("actor_type") == "government_vendor",
    )
    # Both conditions are required: proposed *voluntary* guidance is not proposed regulation.
    proposed_future = _ids(
        us,
        lambda claim: claim["legal_force"] == "proposed" and claim["adoption_status"] == "proposed",
    )

    return {
        "schema_version": DERIVED_SCHEMA_VERSION,
        "record_type": "pilot_headline_judgments",
        "parser_version": PARSER_VERSION,
        "headline_rule": dict(HEADLINE_RULE),
        "EU": {
            "market_provider": (
                "binding_applicable_for_defined_class"
                if eu_decisive
                else "no_current_binding_model_evaluation_requirement"
            ),
            "defined_class": eu_defined_class,
            "decisive_evidence": sorted(claim["claim_id"] for claim in eu_decisive),
            "supporting_evidence": _ids(
                eu, lambda claim: claim["headline_relevance"] in _EU_SUPPORTING_RELEVANCE
            ),
            "qualifying_evidence": _ids(
                eu, lambda claim: claim["headline_relevance"] in _EU_QUALIFYING_RELEVANCE
            ),
        },
        "US": {
            "market_provider_cross_sector": {
                "judgment": (
                    "binding_applicable_for_defined_class"
                    if us_decisive
                    else "no_current_binding_model_evaluation_requirement"
                ),
                "evidence": sorted(claim["claim_id"] for claim in us_decisive),
            },
            "federal_agency_government_use": {
                "judgment": (
                    "binding_testing_and_impact_assessment_requirements"
                    if government_use
                    else "no_binding_government_use_requirement"
                ),
                "evidence": government_use,
            },
            "government_procurement": {
                "judgment": (
                    "binding_agency_controls_and_contract_mediated_vendor_duties"
                    if procurement and contract_mediated
                    else "no_binding_procurement_requirement"
                ),
                "evidence": sorted(set(procurement) | set(contract_mediated)),
            },
            "contract_mediated_government_vendor": {
                "judgment": (
                    "contractual_duties_contingent_on_a_government_contract"
                    if contract_mediated
                    else "no_contract_mediated_vendor_duty"
                ),
                "evidence": contract_mediated,
            },
            "voluntary_cross_sector": {
                "judgment": (
                    "active_evaluation_guidance_and_infrastructure"
                    if voluntary_cross_sector
                    else "no_active_voluntary_guidance"
                ),
                "evidence": voluntary_cross_sector,
            },
            "proposed_future": {
                "judgment": (
                    "reporting_and_disclosure_standard_only"
                    if proposed_future
                    else "no_proposed_future_policy"
                ),
                "evidence": proposed_future,
            },
        },
    }


def _ids(claims: list[dict[str, Any]], predicate: Any) -> list[str]:
    return sorted(claim["claim_id"] for claim in claims if predicate(claim))


def validate_reviewed_dataset(dataset: dict[str, Any], *, root: Path | None = None) -> None:
    """Validate the reviewed table's contract, row numbering, reviews, and reconciliation."""
    # The review gate runs first so an unreviewed record reports as such rather than as a
    # generic contract violation.
    _check_review_decisions(dataset)
    validate_pilot_record("reviewed_dataset", dataset, root=root)
    _check_row_numbering(dataset)
    _check_reconciliation(dataset)


def validate_pilot_graph(
    dataset: dict[str, Any],
    claims: list[dict[str, Any]],
    headlines: dict[str, Any],
    *,
    root: Path | None = None,
) -> None:
    """Validate the normalized claims and derived judgments against the reviewed table."""
    for claim in claims:
        validate_pilot_record("normalized_claim", claim, root=root)
    validate_pilot_record("headline_judgments", headlines, root=root)

    _check_counts(dataset, claims)
    _check_unique_identifiers(dataset, claims)
    _check_parent_child_relationships(dataset, claims)
    _check_lifecycle_values(claims)
    _check_verbatim_preservation(dataset, claims)
    _check_reviewed_value_partitions(claims)
    _check_unknown_preservation(claims)
    _check_actor_and_scope_distinctions(claims)
    _check_voluntary_stays_voluntary(claims, headlines)
    _check_model_evaluation_not_inferred(claims)
    _check_claims_not_merged(claims)
    _check_headline_derivation(dataset, claims, headlines)


def _check_row_numbering(dataset: dict[str, Any]) -> None:
    row_ids = tuple(record["row_id"] for record in dataset["records"])
    if row_ids != EXPECTED_ROW_IDS:
        raise PilotValidationError(
            "reviewed rows must preserve the uploaded table numbering EU-01..EU-12, "
            f"US-01..US-12 in order; found {list(row_ids)}"
        )


def _check_review_decisions(dataset: dict[str, Any]) -> None:
    decisions = Counter(record["review_decision"] for record in dataset["records"])
    unresolved = {key: count for key, count in decisions.items() if key != "accepted"}
    if unresolved:
        raise PilotValidationError(f"reviewed corpus contains non-accepted reviews: {unresolved}")


def _check_reconciliation(dataset: dict[str, Any]) -> None:
    reconciliation = dataset["reconciliation"]
    by_row = {record["row_id"]: record for record in dataset["records"]}

    removed = {
        entry["temporary_row_id"]: entry["source_locator"]
        for entry in reconciliation["removed_from_main_reviewed_corpus"]
    }
    if removed != REMOVED_TEMPORARY_LOCATORS:
        raise PilotValidationError(
            f"reconciliation must record the removed temporary records "
            f"{REMOVED_TEMPORARY_LOCATORS}; found {removed}"
        )

    banned = set(REMOVED_TEMPORARY_LOCATORS.values())
    intruders = {
        row_id: record["source_locator"]
        for row_id, record in by_row.items()
        if record["source_locator"] in banned
    }
    if intruders:
        raise PilotValidationError(
            f"removed temporary records must not occupy reviewed row ids: {intruders}"
        )

    corrected = {
        entry["source_locator"]: entry["corrected_row_id"]
        for entry in reconciliation["corrected_numbering"]
    }
    if corrected != CORRECTED_ARTICLE_55_NUMBERING:
        raise PilotValidationError(
            f"corrected numbering must map {CORRECTED_ARTICLE_55_NUMBERING}; found {corrected}"
        )
    for locator, row_id in EU_LOCATOR_TO_ROW.items():
        record = by_row.get(row_id)
        if record is None or record["source_locator"] != locator:
            found = None if record is None else record["source_locator"]
            raise PilotValidationError(
                f"row {row_id} must carry source locator {locator!r}; found {found!r}"
            )
    for entry in reconciliation["corrected_numbering"]:
        locator = entry["source_locator"]
        previous = by_row.get(entry["previous_row_id"])
        if previous is not None and previous["source_locator"] == locator:
            raise PilotValidationError(
                f"{locator} still occupies its pre-correction row {entry['previous_row_id']}"
            )


def _check_counts(dataset: dict[str, Any], claims: list[dict[str, Any]]) -> None:
    expectations = dataset["validation_expectations"]
    records = dataset["records"]
    actual = {
        "parent_row_count": len(records),
        "eu_parent_row_count": sum(1 for r in records if r["jurisdiction"] == "EU"),
        "us_parent_row_count": sum(1 for r in records if r["jurisdiction"] == "US"),
        "normalized_claim_count": len(claims),
        "pending_review_count": sum(1 for r in records if r["review_decision"] == "pending"),
        "rejected_review_count": sum(1 for r in records if r["review_decision"] == "rejected"),
    }
    mismatched = {
        field: (expectations[field], value)
        for field, value in actual.items()
        if expectations[field] != value
    }
    if mismatched:
        raise PilotValidationError(f"count mismatch (expected, actual): {mismatched}")


def _check_unique_identifiers(dataset: dict[str, Any], claims: list[dict[str, Any]]) -> None:
    row_ids = [record["row_id"] for record in dataset["records"]]
    duplicate_rows = sorted({key for key, count in Counter(row_ids).items() if count > 1})
    if duplicate_rows:
        raise PilotValidationError(f"duplicate parent row ids: {duplicate_rows}")

    claim_ids = [claim["claim_id"] for claim in claims]
    duplicate_claims = sorted({key for key, count in Counter(claim_ids).items() if count > 1})
    if duplicate_claims:
        raise PilotValidationError(f"duplicate claim ids: {duplicate_claims}")


def _check_parent_child_relationships(
    dataset: dict[str, Any], claims: list[dict[str, Any]]
) -> None:
    by_row = {record["row_id"]: record for record in dataset["records"]}
    claims_by_parent: dict[str, list[dict[str, Any]]] = {}
    for claim in claims:
        parent_row_id = claim["parent_row_id"]
        if parent_row_id not in by_row:
            raise PilotValidationError(
                f"claim {claim['claim_id']} references unknown parent row {parent_row_id}"
            )
        claims_by_parent.setdefault(parent_row_id, []).append(claim)

    for row_id, record in by_row.items():
        children = claims_by_parent.get(row_id, [])
        if not children:
            raise PilotValidationError(f"parent row {row_id} produced no normalized claim")
        if record["record_type"] == "source_bundle":
            expected = len(record["derived_claims"])
            if len(children) != expected:
                raise PilotValidationError(
                    f"bundle {row_id} must produce {expected} claims; produced {len(children)}"
                )
            for claim in children:
                if claim["claim_origin"] != "derived_claim":
                    raise PilotValidationError(
                        f"claim {claim['claim_id']} from bundle {row_id} must be a derived_claim"
                    )
                if not claim["claim_id"].startswith(row_id) or len(claim["claim_id"]) != len(
                    row_id
                ) + 1:
                    raise PilotValidationError(
                        f"claim {claim['claim_id']} is not a child identifier of {row_id}"
                    )
        else:
            if len(children) != 1:
                raise PilotValidationError(
                    f"leaf row {row_id} must produce exactly one claim; produced {len(children)}"
                )
            claim = children[0]
            if claim["claim_id"] != row_id or claim["claim_origin"] != "parent_record":
                raise PilotValidationError(
                    f"leaf row {row_id} must produce claim {row_id} of origin parent_record"
                )


def _check_lifecycle_values(claims: list[dict[str, Any]]) -> None:
    allowed = {
        "adoption_status": ALLOWED_ADOPTION_STATUS,
        "applicability_status": ALLOWED_APPLICABILITY_STATUS,
        "enforcement_status": ALLOWED_ENFORCEMENT_STATUS,
    }
    for claim in claims:
        for field in LIFECYCLE_FIELDS:
            if field not in claim:
                raise PilotValidationError(
                    f"claim {claim['claim_id']} is missing lifecycle field {field}"
                )
            if claim[field] not in allowed[field]:
                raise PilotValidationError(
                    f"claim {claim['claim_id']} has disallowed {field}: {claim[field]!r}"
                )
        if "legal_force" not in claim:
            raise PilotValidationError(f"claim {claim['claim_id']} is missing legal_force")
        # Legal force is recorded separately from compliance function and never derived from it.
        if "lifecycle_status" in claim or "legal_status" in claim:
            raise PilotValidationError(
                f"claim {claim['claim_id']} merges separately recorded status dimensions"
            )


def _check_verbatim_preservation(dataset: dict[str, Any], claims: list[dict[str, Any]]) -> None:
    """Every reviewed field must survive normalization unchanged."""
    by_id = {claim["claim_id"]: claim for claim in claims}
    for claim_id, _parent_row_id, source in source_claim_units(dataset):
        claim = by_id.get(claim_id)
        if claim is None:
            raise PilotValidationError(f"reviewed claim {claim_id} is missing from the claims")
        for field, value in source.items():
            if field in _CHILD_TABLE_FIELDS or field in _PARENT_TABLE_FIELDS:
                continue
            if field not in claim:
                raise PilotValidationError(
                    f"claim {claim_id} dropped reviewed field {field}"
                )
            if claim[field] != value:
                raise PilotValidationError(
                    f"claim {claim_id} altered reviewed field {field}: "
                    f"{value!r} became {claim[field]!r}"
                )


def _check_reviewed_value_partitions(claims: list[dict[str, Any]]) -> None:
    """Every reviewed value must stay in the bucket the reviewer placed it in.

    This is the general form of rules 4 through 10: legal force, the three lifecycle
    dimensions, actor, binding scope, conduct, and compliance function are each pinned
    as a claim-id partition, so relabelling any of them fails even when the change would
    leave the headline judgments arithmetically unchanged.
    """
    for field, partition in REVIEWED_FIELD_PARTITIONS.items():
        observed: dict[str, set[str]] = {}
        for claim in claims:
            observed.setdefault(claim.get(field, ABSENT), set()).add(claim["claim_id"])
        for value, expected in partition.items():
            found = observed.get(value, set())
            if found != expected:
                lost = sorted(expected - found)
                gained = sorted(found - expected)
                raise PilotValidationError(
                    f"reviewed {field}={value!r} was not preserved; "
                    f"lost {lost}, gained {gained}"
                )
        unexpected = sorted(set(observed) - set(partition))
        if unexpected:
            raise PilotValidationError(f"unreviewed {field} values appeared: {unexpected}")


def _check_unknown_preservation(claims: list[dict[str, Any]]) -> None:
    """`unknown` is a recorded value, not a missing one, and absorbs nothing else."""
    for claim in claims:
        status = claim.get("enforcement_status")
        if not status:
            raise PilotValidationError(
                f"claim {claim['claim_id']} has no enforcement status; "
                "unknown must be recorded, never omitted"
            )
    unknown = {claim["claim_id"] for claim in claims if claim["enforcement_status"] == "unknown"}
    if unknown != UNKNOWN_ENFORCEMENT_CLAIM_IDS:
        lost = sorted(UNKNOWN_ENFORCEMENT_CLAIM_IDS - unknown)
        gained = sorted(unknown - UNKNOWN_ENFORCEMENT_CLAIM_IDS)
        raise PilotValidationError(
            f"unknown enforcement status was not preserved; lost {lost}, gained {gained}. "
            "`unknown`, `not_applicable`, and `not_determinable_from_passage` are "
            "distinct reviewed facts and none may absorb another."
        )


def _check_actor_and_scope_distinctions(claims: list[dict[str, Any]]) -> None:
    # No US claim places a duty on a market provider. Market providers appear in US records
    # only as indirectly affected (US-06), expressly excluded (US-07), or prospective (US-11).
    us_market_provider = sorted(
        claim["claim_id"]
        for claim in claims
        if claim["jurisdiction"] == "US" and claim.get("actor_type") == "market_provider"
    )
    if us_market_provider:
        raise PilotValidationError(
            "no US claim may place a duty on a market provider; "
            f"found {us_market_provider}. Government-use, procurement, and proposed "
            "policy never become general market-provider obligations."
        )

    without_actor = {claim["claim_id"] for claim in claims if "actor_type" not in claim}
    if without_actor != CLAIMS_WITHOUT_ACTOR_TYPE:
        raise PilotValidationError(
            f"claims recording no duty-bearing actor must be {sorted(CLAIMS_WITHOUT_ACTOR_TYPE)}; "
            f"found {sorted(without_actor)}"
        )

    for claim in claims:
        claim_id = claim["claim_id"]
        binding_scope = claim.get("binding_scope")
        if (
            binding_scope in GOVERNMENT_ONLY_BINDING_SCOPES
            and claim.get("actor_type") == "market_provider"
        ):
            raise PilotValidationError(
                f"claim {claim_id} makes a {binding_scope} duty a market-provider obligation"
            )
        if claim["legal_force"] == "contractual":
            if claim.get("actor_type") != "government_vendor":
                raise PilotValidationError(
                    f"contractual claim {claim_id} must bind a government_vendor, "
                    f"not {claim.get('actor_type')!r}"
                )
            if claim.get("binding_scope") != "government_contract_only":
                raise PilotValidationError(
                    f"contractual claim {claim_id} must stay scoped to the government contract"
                )
        # An indirectly affected or prospective actor never becomes the duty-bearing actor.
        for field in (
            "indirectly_affected_actor_type",
            "prospective_actor_type",
            "additional_affected_actor_type",
        ):
            if field in claim and claim.get("actor_type") == claim[field]:
                raise PilotValidationError(
                    f"claim {claim_id} promoted {field} into actor_type: {claim[field]!r}"
                )
        if "cross_sector" in claim.get("scope", []) and binding_scope is not None:
            raise PilotValidationError(
                f"claim {claim_id} claims cross-sector scope for a {binding_scope} duty"
            )


def _check_voluntary_stays_voluntary(
    claims: list[dict[str, Any]], headlines: dict[str, Any]
) -> None:
    voluntary = LEGAL_FORCE_PARTITION["voluntary"]
    # A recognized compliance path is a route for demonstrating compliance, not a duty.
    for claim in claims:
        if (
            claim.get("compliance_function") == "recognized_compliance_path"
            and claim["legal_force"] != "voluntary"
        ):
            raise PilotValidationError(
                f"claim {claim['claim_id']} turned a recognized compliance path into a "
                f"{claim['legal_force']} obligation"
            )
    binding_evidence = set(headlines["EU"]["decisive_evidence"])
    binding_evidence |= set(headlines["US"]["federal_agency_government_use"]["evidence"])
    binding_evidence |= set(headlines["US"]["market_provider_cross_sector"]["evidence"])
    leaked = sorted(binding_evidence & voluntary)
    if leaked:
        raise PilotValidationError(
            f"voluntary claims were used as evidence of a binding requirement: {leaked}"
        )


def _check_model_evaluation_not_inferred(claims: list[dict[str, Any]]) -> None:
    evaluated = {
        claim["claim_id"] for claim in claims if claim.get("conduct_type") == "model_evaluation"
    }
    if evaluated != MODEL_EVALUATION_CLAIM_IDS:
        missing = sorted(MODEL_EVALUATION_CLAIM_IDS - evaluated)
        added = sorted(evaluated - MODEL_EVALUATION_CLAIM_IDS)
        raise PilotValidationError(
            "the reviewed model-evaluation claims changed; "
            f"lost {missing}, gained {added}. Documentation, risk assessment, monitoring, "
            "reporting, and testing access are not model evaluation."
        )
    # `evaluation` is a conduct *family*, never a conduct type. The two vocabularies are
    # disjoint, so a family value can never be written into conduct_type.
    family = {
        claim["claim_id"]: claim.get("conduct_type")
        for claim in claims
        if claim.get("conduct_family") == "evaluation"
    }
    if family != CONDUCT_FAMILY_EVALUATION_CONDUCT:
        raise PilotValidationError(
            f"claims in the evaluation conduct family must be "
            f"{CONDUCT_FAMILY_EVALUATION_CONDUCT}; found {family}"
        )
    promoted = sorted(set(family) & evaluated)
    if promoted:
        raise PilotValidationError(
            f"claims {promoted} were promoted from conduct_family to model_evaluation. "
            "An agency testing a system it will use or buy is not a provider evaluating a model."
        )


def _distinctness_key(claim: dict[str, Any]) -> tuple[Any, ...]:
    return (
        claim["source_locator"],
        claim["instrument"],
        claim.get("conduct_type"),
        claim.get("actor_type"),
        claim.get("target_system"),
        claim["applicability_status"],
    )


def _check_claims_not_merged(claims: list[dict[str, Any]]) -> None:
    seen: dict[tuple[Any, ...], str] = {}
    for claim in claims:
        key = _distinctness_key(claim)
        if key in seen:
            raise PilotValidationError(
                f"claims {seen[key]} and {claim['claim_id']} collapsed into one legal claim"
            )
        seen[key] = claim["claim_id"]


def _check_headline_derivation(
    dataset: dict[str, Any], claims: list[dict[str, Any]], headlines: dict[str, Any]
) -> None:
    derived = derive_headline_judgments(claims)
    if derived != headlines:
        raise PilotValidationError("supplied headline judgments do not match the derived ones")

    stated = dataset["headline_judgments"]
    stated_eu = stated["EU"]
    derived_eu = derived["EU"]
    if derived_eu["market_provider"] != _collapse(stated_eu["market_provider"]):
        raise PilotValidationError(
            f"derived EU headline {derived_eu['market_provider']!r} contradicts the reviewed "
            f"{_collapse(stated_eu['market_provider'])!r}"
        )
    if derived_eu["market_provider"] != "binding_applicable_for_defined_class":
        raise PilotValidationError(
            "the EU market-provider headline must be positive for the systemic-risk GPAI class"
        )
    if derived_eu["decisive_evidence"] != ["EU-06"]:
        raise PilotValidationError(
            f"EU-06 must be the decisive evidence; derived {derived_eu['decisive_evidence']}"
        )
    if derived_eu["decisive_evidence"] != sorted(stated_eu["decisive_evidence"]):
        raise PilotValidationError("derived EU decisive evidence differs from the reviewed table")
    if derived_eu["supporting_evidence"] != sorted(stated_eu["supporting_evidence"]):
        raise PilotValidationError(
            f"derived EU supporting evidence {derived_eu['supporting_evidence']} differs from "
            f"the reviewed {sorted(stated_eu['supporting_evidence'])}"
        )
    if derived_eu["defined_class"] != _collapse(stated_eu["defined_class"]):
        raise PilotValidationError("derived EU defined class differs from the reviewed table")
    qualification = _collapse(stated_eu["qualification"])
    for claim_id in derived_eu["qualifying_evidence"]:
        if claim_id not in qualification:
            raise PilotValidationError(
                f"qualifying claim {claim_id} is not named in the reviewed qualification"
            )

    stated_us = stated["US"]
    derived_us = derived["US"]
    if derived_us["market_provider_cross_sector"]["evidence"]:
        raise PilotValidationError(
            "no US claim may establish a current binding cross-sector model-evaluation duty; "
            f"found {derived_us['market_provider_cross_sector']['evidence']}"
        )
    for key, stated_value in stated_us.items():
        derived_value = derived_us[key]["judgment"]
        if derived_value != _collapse(stated_value):
            raise PilotValidationError(
                f"derived US finding {key} is {derived_value!r}, "
                f"reviewed table says {_collapse(stated_value)!r}"
            )
        if key != "market_provider_cross_sector" and not derived_us[key]["evidence"]:
            raise PilotValidationError(f"US finding {key} has no supporting claim")
    if not derived_us["contract_mediated_government_vendor"]["evidence"]:
        raise PilotValidationError("contract-mediated government-vendor duties must be preserved")


def build_pilot(path: Path | None = None, *, root: Path | None = None) -> dict[str, Any]:
    """Load, validate, normalize, and derive. Returns the full validated pilot output."""
    dataset = load_reviewed_dataset(path)
    validate_reviewed_dataset(dataset, root=root)
    claims = normalize_claims(dataset)
    headlines = derive_headline_judgments(claims)
    validate_pilot_graph(dataset, claims, headlines, root=root)
    return {"dataset": dataset, "claims": claims, "headline_judgments": headlines}


def summarize(dataset: dict[str, Any], claims: list[dict[str, Any]]) -> dict[str, Any]:
    """A deterministic summary for the emit script's `--check` output."""
    records = dataset["records"]
    return {
        "parent_rows": len(records),
        "eu_parent_rows": sum(1 for record in records if record["jurisdiction"] == "EU"),
        "us_parent_rows": sum(1 for record in records if record["jurisdiction"] == "US"),
        "source_bundles": sum(1 for record in records if record["record_type"] == "source_bundle"),
        "normalized_claims": len(claims),
        "claims_from_parent_records": sum(
            1 for claim in claims if claim["claim_origin"] == "parent_record"
        ),
        "claims_from_derived_claims": sum(
            1 for claim in claims if claim["claim_origin"] == "derived_claim"
        ),
        "pending_reviews": sum(1 for r in records if r["review_decision"] == "pending"),
        "rejected_reviews": sum(1 for r in records if r["review_decision"] == "rejected"),
        "model_evaluation_claims": sorted(
            claim["claim_id"] for claim in claims if claim.get("conduct_type") == "model_evaluation"
        ),
        "unknown_enforcement_status": sum(
            1 for claim in claims if claim["enforcement_status"] == "unknown"
        ),
        "legal_force_distribution": dict(
            sorted(Counter(claim["legal_force"] for claim in claims).items())
        ),
    }
