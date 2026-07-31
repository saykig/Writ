"""Canonical source-registry loading, validation, and URL policy."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.parse import urldefrag, urlparse

import yaml
from jsonschema import Draft202012Validator, FormatChecker

REGISTRY_RELATIVE_PATH = Path("config/source_registry.yml")
REGISTRY_SCHEMA_RELATIVE_PATH = Path(
    "schemas/compatibility/compliance-corpus-v2/source_registry_config.schema.json"
)

LEGACY_ENTRY_KEYS = {
    "id",
    "name",
    "publisher",
    "jurisdictions",
    "issue_areas",
    "source_tier",
    "source_types",
    "base_uri",
    "api_spec_uri",
    "discovery_method",
    "fetch_method",
    "authentication",
    "rate_limit",
    "crawl_schedule",
    "robots_policy",
    "terms_status",
    "languages",
    "expected_formats",
    "connector",
    "enabled",
    "verification_status",
    "last_verified",
    "notes",
}


class RegistryError(RuntimeError):
    """Base class for governed registry failures."""


class RegistryNotFoundError(RegistryError):
    """The canonical registry or its schema is missing."""


class RegistryValidationError(RegistryError):
    """The registry violates schema or semantic policy."""


class UnknownSourceError(RegistryError):
    """A caller requested a source that is not registered."""


class UrlPolicyError(RegistryError):
    """A URL falls outside a source's registered egress policy."""


def find_repo_root(start: Path | None = None) -> Path:
    """Find the repository root without depending on the current directory."""
    cursor = (start or Path(__file__)).resolve()
    if cursor.is_file():
        cursor = cursor.parent
    for candidate in (cursor, *cursor.parents):
        if (candidate / "AGENTS.md").is_file() and (candidate / "apps").is_dir():
            return candidate
    raise RegistryNotFoundError("could not locate repository root containing AGENTS.md")


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RegistryNotFoundError(f"registry schema is missing: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RegistryValidationError(f"invalid JSON schema {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise RegistryValidationError(f"schema must be a JSON object: {path}")
    return value


def _format_schema_errors(errors: list[Any]) -> str:
    rendered: list[str] = []
    for error in errors[:20]:
        path = "/" + "/".join(str(part) for part in error.absolute_path)
        rendered.append(f"{path}: {error.message}")
    return "; ".join(rendered)


def _validate_url_shape(url: str, allowed_domains: list[str]) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise UrlPolicyError(f"only https URLs are permitted: {url}")
    if parsed.username is not None or parsed.password is not None:
        raise UrlPolicyError(f"URL credentials are prohibited: {url}")
    if parsed.port not in (None, 443):
        raise UrlPolicyError(f"non-default URL ports are prohibited: {url}")
    if parsed.hostname is None:
        raise UrlPolicyError(f"URL has no hostname: {url}")
    hostname = parsed.hostname.encode("idna").decode("ascii").lower()
    allowed = {domain.encode("idna").decode("ascii").lower() for domain in allowed_domains}
    if hostname not in allowed:
        raise UrlPolicyError(f"hostname {hostname!r} is not in the source allowlist")


def _validate_registry_semantics(document: dict[str, Any]) -> None:
    sources = document["sources"]
    ids = [source["id"] for source in sources]
    if len(ids) != len(set(ids)):
        duplicates = sorted({source_id for source_id in ids if ids.count(source_id) > 1})
        raise RegistryValidationError(f"duplicate source ids: {', '.join(duplicates)}")

    known_ids = set(ids)
    for source in sources:
        related = source.get("related_source_ids", [])
        missing = sorted(set(related) - known_ids)
        if missing:
            raise RegistryValidationError(
                f"source {source['id']} references unregistered sources: {', '.join(missing)}"
            )
        discovery = source.get("discovery")
        if discovery is None:
            continue
        seed_url = discovery["seed_url"]
        parsed = urlparse(seed_url)
        if parsed.fragment:
            raise RegistryValidationError(
                f"source {source['id']} seed_url must not contain a fragment; use section_anchor"
            )
        try:
            _validate_url_shape(seed_url, discovery["allowed_domains"])
        except UrlPolicyError as exc:
            raise RegistryValidationError(f"source {source['id']}: {exc}") from exc
        if source["base_uri"] != seed_url:
            raise RegistryValidationError(
                f"source {source['id']} base_uri must equal discovery.seed_url"
            )


def load_registry(
    path: Path | None = None,
    *,
    schema_path: Path | None = None,
) -> dict[str, Any]:
    """Load and validate the canonical YAML registry."""
    root = find_repo_root()
    registry_path = path or root / REGISTRY_RELATIVE_PATH
    contract_path = schema_path or root / REGISTRY_SCHEMA_RELATIVE_PATH
    try:
        parsed = yaml.safe_load(registry_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RegistryNotFoundError(
            f"canonical source registry is missing: {registry_path}"
        ) from exc
    except yaml.YAMLError as exc:
        raise RegistryValidationError(f"invalid registry YAML {registry_path}: {exc}") from exc
    if not isinstance(parsed, dict):
        raise RegistryValidationError("canonical source registry must be a mapping")

    schema = _read_json(contract_path)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(parsed), key=lambda item: list(item.absolute_path))
    if errors:
        raise RegistryValidationError(
            f"invalid canonical source registry: {_format_schema_errors(errors)}"
        )
    _validate_registry_semantics(parsed)
    return parsed


def get_source(registry: dict[str, Any], source_id: str) -> dict[str, Any]:
    """Resolve a stable source id or fail closed."""
    for source in registry["sources"]:
        if source["id"] == source_id:
            return source
    raise UnknownSourceError(f"unregistered source requested: {source_id}")


def validate_source_url(source: dict[str, Any], url: str) -> str:
    """Validate a fetch URL and return its fragment-free request form."""
    discovery = source.get("discovery")
    if discovery is None:
        raise UrlPolicyError(f"source {source['id']} has no discovery allowlist")
    request_url, _fragment = urldefrag(url)
    _validate_url_shape(request_url, discovery["allowed_domains"])
    return request_url


def project_legacy_registry(registry: dict[str, Any]) -> dict[str, Any]:
    """Project the canonical YAML into the existing API seed contract."""
    entries: list[dict[str, Any]] = []
    for source in registry["sources"]:
        entries.append({key: source[key] for key in source if key in LEGACY_ENTRY_KEYS})
    return {"schema_version": "1.0.0", "entries": entries}


def canonical_json_bytes(value: Any) -> bytes:
    """Render deterministic checked-in JSON."""
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
