from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[4]
QUERY_PATH = ROOT / "queries/eu-us-ai-governance-pilot/query.yaml"


def load(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def test_saved_query_references_independent_versioned_corpora() -> None:
    query = load(QUERY_PATH)
    assert query["contract_version"] == "1.0.0"
    catalog = load(ROOT / query["catalog"])
    by_id = {item["corpus_id"]: item for item in catalog["native_corpora"]}
    assert len(query["corpus_ids"]) == 13
    assert set(query["corpus_ids"]) <= set(by_id)
    assert not any("ai-governance" in corpus_id for corpus_id in query["corpus_ids"])

    for corpus_id in query["corpus_ids"]:
        selected = by_id[corpus_id]
        manifest = load(ROOT / selected["manifest"])
        assert manifest["corpus_id"] == corpus_id
        assert "question" not in manifest
        assert "pilot_question" not in manifest


def test_saved_query_inputs_resolve_once_and_preserve_missing_coverage() -> None:
    query = load(QUERY_PATH)
    claims: dict[str, dict] = {}
    unresolved: dict[str, dict] = {}
    catalog = load(ROOT / query["catalog"])
    by_id = {item["corpus_id"]: item for item in catalog["native_corpora"]}
    for corpus_id in query["corpus_ids"]:
        base = ROOT / by_id[corpus_id]["path"]
        for claim in load(base / "records/claims.yaml")["claims"]:
            assert claim["machine_id"] not in claims
            claims[claim["machine_id"]] = claim
        for item in load(base / "passages/unresolved.yaml")["unresolved"]:
            assert item["machine_id"] not in unresolved
            unresolved[item["machine_id"]] = item

    included = query["evidence"]["included"]
    assert len(included) == len(set(included)) == 32
    assert set(included) == set(claims)
    assert all(item["status"] == "unresolved" for item in query["unresolved_or_contested"])
    assert {item["record_id"] for item in query["unresolved_or_contested"]} == set(unresolved)


def test_derived_results_are_not_source_reported_judgments() -> None:
    query = load(QUERY_PATH)
    for result in [*query["resulting_claims"], query["answer_trace"]]:
        assert result["origin"] == "writ_derived"
        assert result["writ_derived"] is True
        for field in ("methodology_id", "methodology_version", "input_record_ids", "trace_id"):
            assert field in result
        assert result["input_record_ids"]
    assert query["answer_trace"]["input_record_ids"] == query["evidence"]["included"]
