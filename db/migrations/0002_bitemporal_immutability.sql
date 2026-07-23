-- 0002_bitemporal_immutability.sql
--
-- Refines the baseline schema (0001) to satisfy the Writ ledger invariants:
--   * institutions / institution_aliases (identity of publishers and actors);
--   * bitemporal version rows for claims and actions (valid-time + system-time);
--   * immutability of frozen / published rows (snapshots, receipts, published
--     releases, audit events) enforced by triggers;
--   * accepted claims are superseded via new rows, never edited in place;
--   * evidence-link stance / support_type aligned to specs/evidence.schema.json.
--
-- Additive and idempotent-friendly: it never rewrites 0001. Applyable by psql
-- and by the postgres.js runner (simple protocol, multi-statement).

BEGIN;

-- ---------------------------------------------------------------------------
-- Institutions (publishers, actors, reviewing bodies)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS institutions (
  id text PRIMARY KEY,
  legal_name text NOT NULL,
  short_name text,
  jurisdiction text,
  institution_type text,
  canonical_uri text,
  official_identifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institution_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_type text NOT NULL DEFAULT 'name',
  language text,
  UNIQUE (institution_id, alias, alias_type)
);
CREATE INDEX IF NOT EXISTS institution_aliases_alias_idx ON institution_aliases (lower(alias));

-- Optional structured link from a document to its publishing institution.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS publisher_institution_id text REFERENCES institutions(id);

-- ---------------------------------------------------------------------------
-- Bitemporal columns
--
-- valid-time  : the period the asserted fact holds in the world.
--   claims  -> valid_from / valid_to (already present in 0001)
--   actions -> valid_from / valid_to (already present in 0001)
-- system-time : the period the row is the current record in the ledger.
--   a row is CURRENT while system_to IS NULL; superseding a row closes it by
--   setting system_to and inserting a new row that shares logical_id.
-- ---------------------------------------------------------------------------
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS logical_id text,
  ADD COLUMN IF NOT EXISTS system_from timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS system_to timestamptz;

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS actors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS logical_id text,
  ADD COLUMN IF NOT EXISTS system_from timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS system_to timestamptz;

-- Default logical_id to the row id on insert when the caller does not supply
-- an explicit logical identity (first version of a logical entity).
CREATE OR REPLACE FUNCTION writ_default_logical_id() RETURNS trigger AS $$
BEGIN
  IF NEW.logical_id IS NULL THEN
    NEW.logical_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS claims_default_logical_id ON claims;
CREATE TRIGGER claims_default_logical_id
  BEFORE INSERT ON claims
  FOR EACH ROW EXECUTE FUNCTION writ_default_logical_id();

DROP TRIGGER IF EXISTS actions_default_logical_id ON actions;
CREATE TRIGGER actions_default_logical_id
  BEFORE INSERT ON actions
  FOR EACH ROW EXECUTE FUNCTION writ_default_logical_id();

UPDATE claims SET logical_id = id WHERE logical_id IS NULL;
UPDATE actions SET logical_id = id WHERE logical_id IS NULL;
ALTER TABLE claims ALTER COLUMN logical_id SET NOT NULL;
ALTER TABLE actions ALTER COLUMN logical_id SET NOT NULL;

-- At most one open (current) system-time row per logical entity.
CREATE UNIQUE INDEX IF NOT EXISTS claims_open_version_uidx
  ON claims (logical_id) WHERE system_to IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS actions_open_version_uidx
  ON actions (logical_id) WHERE system_to IS NULL;
CREATE INDEX IF NOT EXISTS claims_logical_system_idx
  ON claims (logical_id, system_from DESC);
CREATE INDEX IF NOT EXISTS actions_logical_system_idx
  ON actions (logical_id, system_from DESC);

-- ---------------------------------------------------------------------------
-- Immutability triggers
-- ---------------------------------------------------------------------------

-- Reject every UPDATE / DELETE: frozen or append-only rows.
CREATE OR REPLACE FUNCTION writ_freeze() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'relation % is immutable; % is not permitted on frozen rows',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

-- Reject UPDATE / DELETE only once a release row is published.
CREATE OR REPLACE FUNCTION writ_freeze_if_published() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'release % is published and immutable; % rejected', OLD.id, TG_OP
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Accepted claims are superseded via new rows, never edited in place. The only
-- permitted mutation of an accepted claim is closing its system-time interval
-- (status -> superseded/withdrawn, set system_to) with content left unchanged.
CREATE OR REPLACE FUNCTION writ_claims_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('accepted', 'superseded') THEN
      RAISE EXCEPTION 'claim % is % and cannot be deleted; supersede instead', OLD.id, OLD.status
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'accepted' THEN
    IF NEW.status NOT IN ('superseded', 'withdrawn') THEN
      RAISE EXCEPTION 'accepted claim % is immutable; create a superseding claim', OLD.id
        USING ERRCODE = '23514';
    END IF;
    IF NEW.claim_type   IS DISTINCT FROM OLD.claim_type
       OR NEW.subject_ref  IS DISTINCT FROM OLD.subject_ref
       OR NEW.predicate    IS DISTINCT FROM OLD.predicate
       OR NEW.object_value IS DISTINCT FROM OLD.object_value
       OR NEW.qualifiers   IS DISTINCT FROM OLD.qualifiers
       OR NEW.truth_value  IS DISTINCT FROM OLD.truth_value
       OR NEW.valid_from   IS DISTINCT FROM OLD.valid_from
       OR NEW.recorded_at  IS DISTINCT FROM OLD.recorded_at
       OR NEW.origin       IS DISTINCT FROM OLD.origin
       OR NEW.logical_id   IS DISTINCT FROM OLD.logical_id THEN
      RAISE EXCEPTION 'accepted claim % content is immutable; only the system-time interval may close', OLD.id
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS evidence_snapshots_freeze ON evidence_snapshots;
CREATE TRIGGER evidence_snapshots_freeze
  BEFORE UPDATE OR DELETE ON evidence_snapshots
  FOR EACH ROW EXECUTE FUNCTION writ_freeze();

DROP TRIGGER IF EXISTS snapshot_members_freeze ON snapshot_document_versions;
CREATE TRIGGER snapshot_members_freeze
  BEFORE UPDATE OR DELETE ON snapshot_document_versions
  FOR EACH ROW EXECUTE FUNCTION writ_freeze();

DROP TRIGGER IF EXISTS evaluation_receipts_freeze ON evaluation_receipts;
CREATE TRIGGER evaluation_receipts_freeze
  BEFORE UPDATE OR DELETE ON evaluation_receipts
  FOR EACH ROW EXECUTE FUNCTION writ_freeze();

DROP TRIGGER IF EXISTS audit_events_freeze ON audit_events;
CREATE TRIGGER audit_events_freeze
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION writ_freeze();

DROP TRIGGER IF EXISTS releases_freeze ON releases;
CREATE TRIGGER releases_freeze
  BEFORE UPDATE OR DELETE ON releases
  FOR EACH ROW EXECUTE FUNCTION writ_freeze_if_published();

DROP TRIGGER IF EXISTS claims_guard ON claims;
CREATE TRIGGER claims_guard
  BEFORE UPDATE OR DELETE ON claims
  FOR EACH ROW EXECUTE FUNCTION writ_claims_guard();

-- ---------------------------------------------------------------------------
-- Spec alignment: evidence-link stance / support_type
-- (specs/evidence.schema.json is authoritative for record shapes)
-- ---------------------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'claim_evidence_links'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE claim_evidence_links DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE claim_evidence_links
  ADD CONSTRAINT claim_evidence_links_stance_check
    CHECK (stance IN ('supports', 'contradicts', 'qualifies', 'context_only')),
  ADD CONSTRAINT claim_evidence_links_support_type_check
    CHECK (support_type IN ('direct', 'derived', 'corroborating', 'negative_search'));

-- ---------------------------------------------------------------------------
-- Spec alignment: discrepancy resolution_status / category and release status
-- (specs/discrepancy.schema.json, specs/release.schema.json)
-- ---------------------------------------------------------------------------
ALTER TABLE discrepancies
  DROP CONSTRAINT IF EXISTS discrepancies_resolution_status_check,
  ADD CONSTRAINT discrepancies_resolution_status_check
    CHECK (resolution_status IN ('open', 'under_review', 'resolved', 'accepted_difference'));

ALTER TABLE discrepancies
  DROP CONSTRAINT IF EXISTS discrepancies_category_check,
  ADD CONSTRAINT discrepancies_category_check
    CHECK (category IN (
      'missing_evidence', 'implicit_interpretation', 'rule_gap', 'rule_overlap',
      'prose_metric_mismatch', 'action_identity_ambiguity', 'attribution_ambiguity',
      'temporal_ambiguity', 'extraction_error', 'published_data_inconsistency',
      'implementation_defect'
    ));

ALTER TABLE releases
  DROP CONSTRAINT IF EXISTS releases_status_check,
  ADD CONSTRAINT releases_status_check
    CHECK (status IN ('draft', 'candidate', 'published', 'withdrawn'));

COMMIT;
