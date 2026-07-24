"""G20 adapter boundary; implementation remains blocked until source access is approved."""

from __future__ import annotations

from .base import AdapterOutput


class G20AdapterUnavailableError(RuntimeError):
    """The schema migration must not parse or fetch G20 source material."""


class G20Adapter:
    def emit(self) -> AdapterOutput:
        raise G20AdapterUnavailableError(
            "G20 adapter is fetch-disabled; no Rio source files have been approved"
        )
