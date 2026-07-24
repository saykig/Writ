"""Append-only Neon storage for corpus artifacts.

Connection strings are accepted only as runtime inputs. They are never written
to manifests, provenance, logs, or repository configuration.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any

from psycopg import Connection
from psycopg.types.json import Jsonb

SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9._-]+$")


class OnlineStoreError(RuntimeError):
    """An online corpus write failed closed."""


@dataclass(frozen=True)
class OnlineArtifact:
    logical_id: str
    object_id: str
    source_id: str
    object_kind: str
    sha256: str
    byte_size: int
    media_type: str
    content: bytes
    schema_version: str | None
    summit_slug: str | None
    provenance: dict[str, Any]


def _sha256(value: bytes) -> str:
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def prepare_online_artifact(
    *,
    logical_id: str,
    source_id: str,
    object_kind: str,
    content: bytes,
    media_type: str,
    provenance: dict[str, Any],
    schema_version: str | None = None,
    summit_slug: str | None = None,
) -> OnlineArtifact:
    if not SAFE_ID.fullmatch(source_id):
        raise OnlineStoreError(f"unsafe source id: {source_id}")
    if not logical_id or not content:
        raise OnlineStoreError("online corpus artifacts require a logical id and non-empty bytes")
    digest = _sha256(content)
    identity = _sha256(f"{logical_id}\0{digest}".encode()).removeprefix("sha256:")
    return OnlineArtifact(
        logical_id=logical_id,
        object_id=f"corpus:{identity}",
        source_id=source_id,
        object_kind=object_kind,
        sha256=digest,
        byte_size=len(content),
        media_type=media_type,
        content=bytes(content),
        schema_version=schema_version,
        summit_slug=summit_slug,
        provenance=dict(provenance),
    )


def publish_online_artifact(
    connection: Connection[Any],
    artifact: OnlineArtifact,
) -> dict[str, Any]:
    """Insert one immutable version, or report an identical current version."""
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (artifact.logical_id,))
        cursor.execute(
            """
            SELECT id, artifact_sha256, supersedes_object_id
            FROM corpus_current_objects
            WHERE logical_id = %s
            """,
            (artifact.logical_id,),
        )
        current_rows = cursor.fetchall()
        if len(current_rows) > 1:
            raise OnlineStoreError(
                f"logical corpus object has multiple current versions: {artifact.logical_id}"
            )
        current = current_rows[0] if current_rows else None
        if current and current[1] == artifact.sha256:
            return {
                "created": False,
                "object_id": current[0],
                "sha256": artifact.sha256,
                "supersedes_object_id": current[2],
                "storage_backend": "neon_postgres",
            }
        cursor.execute(
            """
            INSERT INTO corpus_blobs (sha256, content, byte_size, media_type)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (sha256) DO NOTHING
            """,
            (artifact.sha256, artifact.content, artifact.byte_size, artifact.media_type),
        )
        cursor.execute(
            """
            INSERT INTO corpus_objects (
              id, logical_id, source_id, object_kind, schema_version, summit_slug,
              artifact_sha256, provenance, supersedes_object_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                artifact.object_id,
                artifact.logical_id,
                artifact.source_id,
                artifact.object_kind,
                artifact.schema_version,
                artifact.summit_slug,
                artifact.sha256,
                Jsonb(artifact.provenance),
                current[0] if current else None,
            ),
        )
        return {
            "created": True,
            "object_id": artifact.object_id,
            "sha256": artifact.sha256,
            "supersedes_object_id": current[0] if current else None,
            "storage_backend": "neon_postgres",
        }


def read_online_artifact(
    connection: Connection[Any],
    *,
    logical_id: str,
) -> tuple[bytes, dict[str, Any]]:
    """Read the current immutable bytes and provenance for a logical object."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT object_row.id, object_row.artifact_sha256, blob_row.content,
                   blob_row.media_type, object_row.provenance
            FROM corpus_current_objects AS object_row
            JOIN corpus_blobs AS blob_row
              ON blob_row.sha256 = object_row.artifact_sha256
            WHERE object_row.logical_id = %s
            """,
            (logical_id,),
        )
        rows = cursor.fetchall()
    if len(rows) > 1:
        raise OnlineStoreError(f"logical corpus object has multiple current versions: {logical_id}")
    if not rows:
        raise OnlineStoreError(f"online corpus object not found: {logical_id}")
    row = rows[0]
    return bytes(row[2]), {
        "object_id": row[0],
        "sha256": row[1],
        "media_type": row[3],
        "provenance": row[4],
        "storage_backend": "neon_postgres",
    }
