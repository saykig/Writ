"""Smoke test wiring the ingest test harness; expanded during the ingestion phase."""

from writ_ingest.main import app


def test_app_exposes_health_route() -> None:
    routes = {route.path for route in app.routes}
    assert "/health" in routes
