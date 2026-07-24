"""Fail-closed fetch planning and explicitly gated live HTTP acquisition."""

from __future__ import annotations

import ipaddress
import socket
from collections.abc import Callable
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

from .registry import validate_source_url


class FetchGateError(RuntimeError):
    """Fetching was attempted without the required explicit authorization."""


class FetchSecurityError(RuntimeError):
    """A target failed safe-fetch validation."""


def plan_seed_fetch(source: dict[str, Any]) -> dict[str, str]:
    discovery = source["discovery"]
    request_url = validate_source_url(source, discovery["seed_url"])
    return {
        "source_id": source["id"],
        "request_url": request_url,
        "section_anchor": discovery["section_anchor"],
    }


def validate_redirect_chain(source: dict[str, Any], urls: list[str]) -> list[str]:
    if not urls:
        raise FetchSecurityError("redirect chain must contain at least one URL")
    return [validate_source_url(source, url) for url in urls]


def resolve_global_addresses(hostname: str) -> list[str]:
    addresses = sorted(
        {str(row[4][0]) for row in socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)}
    )
    if not addresses:
        raise FetchSecurityError(f"hostname did not resolve: {hostname}")
    for address in addresses:
        if not ipaddress.ip_address(address).is_global:
            raise FetchSecurityError(f"hostname resolved to a non-global address: {address}")
    return addresses


def fetch_live_bytes(
    *,
    source: dict[str, Any],
    source_url: str,
    approved_live_access: bool,
    max_redirects: int = 5,
    max_bytes: int = 25_000_000,
    resolver: Callable[[str], list[str]] = resolve_global_addresses,
) -> tuple[bytes, dict[str, Any]]:
    """Fetch bytes without persisting them; the caller must publish online."""
    if not approved_live_access:
        raise FetchGateError("live fetching requires explicit approved_live_access")
    current_url = validate_source_url(source, source_url)
    redirect_chain = [current_url]
    response: httpx.Response | None = None
    with httpx.Client(follow_redirects=False, timeout=30.0) as client:
        for _hop in range(max_redirects + 1):
            hostname = urlparse(current_url).hostname
            if hostname is None:
                raise FetchSecurityError(f"URL has no hostname: {current_url}")
            resolver(hostname)
            response = client.get(current_url)
            if response.is_redirect:
                location = response.headers.get("location")
                if not location:
                    raise FetchSecurityError("redirect response has no location")
                current_url = validate_source_url(source, urljoin(current_url, location))
                redirect_chain.append(current_url)
                continue
            break
        else:
            raise FetchSecurityError("redirect limit exceeded")

    if response is None:
        raise FetchSecurityError("fetch produced no response")
    response.raise_for_status()
    if len(response.content) > max_bytes:
        raise FetchSecurityError(f"response exceeded maximum size of {max_bytes} bytes")
    content_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    expected = {value.lower() for value in source.get("expected_formats", [])}
    if expected and content_type not in expected:
        raise FetchSecurityError(f"unexpected content type: {content_type or '<missing>'}")

    return response.content, {
        "provenance": "approved_live_fetch",
        "requested_url": source_url,
        "resolved_url": current_url,
        "redirect_chain": redirect_chain,
        "media_type": content_type,
    }
