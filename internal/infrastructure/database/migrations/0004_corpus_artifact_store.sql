-- 0004_corpus_artifact_store.sql
--
-- Append-only, content-addressed online storage for source-corpus artifacts.
-- Raw bytes are immutable. Logical objects are versioned by inserting a new
-- row that points to the prior version; no object or blob is overwritten.

BEGIN;

CREATE TABLE IF NOT EXISTS corpus_blobs (
  sha256 text PRIMARY KEY,
  content bytea NOT NULL,
  byte_size bigint NOT NULL,
  media_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sha256 ~ '^sha256:[0-9a-f]{64}$'),
  CHECK (byte_size = octet_length(content)),
  CHECK (
    sha256 = 'sha256:' || encode(digest(content, 'sha256'), 'hex')
  )
);

CREATE TABLE IF NOT EXISTS corpus_objects (
  id text PRIMARY KEY,
  logical_id text NOT NULL,
  source_id text NOT NULL REFERENCES source_registry_entries(id),
  object_kind text NOT NULL,
  schema_version text,
  summit_slug text,
  artifact_sha256 text NOT NULL REFERENCES corpus_blobs(sha256),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  supersedes_object_id text REFERENCES corpus_objects(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, artifact_sha256),
  UNIQUE (supersedes_object_id),
  CHECK (
    object_kind IN (
      'source_registry',
      'schema',
      'source_manifest',
      'ingestion_report',
      'raw_source',
      'normalized_record',
      'benchmark'
    )
  ),
  CHECK (supersedes_object_id IS NULL OR supersedes_object_id <> id)
);

CREATE INDEX IF NOT EXISTS corpus_objects_source_kind_idx
  ON corpus_objects (source_id, object_kind, published_at DESC);
CREATE INDEX IF NOT EXISTS corpus_objects_logical_idx
  ON corpus_objects (logical_id, published_at DESC);

DROP TRIGGER IF EXISTS corpus_blobs_freeze ON corpus_blobs;
CREATE TRIGGER corpus_blobs_freeze
  BEFORE UPDATE OR DELETE ON corpus_blobs
  FOR EACH ROW EXECUTE FUNCTION writ_freeze();

DROP TRIGGER IF EXISTS corpus_objects_freeze ON corpus_objects;
CREATE TRIGGER corpus_objects_freeze
  BEFORE UPDATE OR DELETE ON corpus_objects
  FOR EACH ROW EXECUTE FUNCTION writ_freeze();

CREATE OR REPLACE VIEW corpus_current_objects AS
SELECT
  object_row.id,
  object_row.logical_id,
  object_row.source_id,
  object_row.object_kind,
  object_row.schema_version,
  object_row.summit_slug,
  object_row.artifact_sha256,
  blob_row.byte_size,
  blob_row.media_type,
  object_row.provenance,
  object_row.supersedes_object_id,
  object_row.published_at
FROM corpus_objects AS object_row
JOIN corpus_blobs AS blob_row
  ON blob_row.sha256 = object_row.artifact_sha256
WHERE NOT EXISTS (
  SELECT 1
  FROM corpus_objects AS newer
  WHERE newer.supersedes_object_id = object_row.id
);

COMMIT;
