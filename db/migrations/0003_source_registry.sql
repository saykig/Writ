-- 0003_source_registry.sql
--
-- DATA-004 source registry service.
--
-- Extends source_registry_entries (from 0001) with the structured columns the
-- verification gate and the coverage/health views need, plus a defence-in-depth
-- constraint: a connector may be enabled ONLY when it is verified and eligible.
--
-- Secrets are REFERENCED, never stored: authentication.secret_ref is projected
-- into secret_ref (a handle such as `env:US_CONGRESS_API_KEY` or `vault://...`).
-- The importer strips any raw secret material before persisting `body`.

BEGIN;

ALTER TABLE source_registry_entries
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS publisher text,
  ADD COLUMN IF NOT EXISTS jurisdictions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_tier integer,
  ADD COLUMN IF NOT EXISTS source_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS base_uri text,
  ADD COLUMN IF NOT EXISTS discovery_method text,
  ADD COLUMN IF NOT EXISTS fetch_method text,
  ADD COLUMN IF NOT EXISTS auth_type text,
  ADD COLUMN IF NOT EXISTS secret_ref text,
  ADD COLUMN IF NOT EXISTS terms_status text,
  ADD COLUMN IF NOT EXISTS robots_policy text,
  ADD COLUMN IF NOT EXISTS eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_reason text,
  ADD COLUMN IF NOT EXISTS last_verified date;

-- A connector is enabled only when the verification gate is satisfied.
-- verified verification_status is necessary but not sufficient (the service
-- also checks endpoint, authority, license/rights, retention and secret
-- references before setting eligible = true).
ALTER TABLE source_registry_entries
  DROP CONSTRAINT IF EXISTS source_registry_enabled_requires_verified,
  ADD CONSTRAINT source_registry_enabled_requires_verified
    CHECK (enabled = false OR verification_status = 'verified');

ALTER TABLE source_registry_entries
  DROP CONSTRAINT IF EXISTS source_registry_enabled_requires_eligible,
  ADD CONSTRAINT source_registry_enabled_requires_eligible
    CHECK (enabled = false OR eligible = true);

-- Align verification_status with the source-registry.schema.json enum. The
-- inline 0001 constraint used a divergent vocabulary
-- (unverified/partially_verified/verified/deprecated) that rejects the seed
-- registry's `catalogued` / `verify_before_enable` values.
ALTER TABLE source_registry_entries
  DROP CONSTRAINT IF EXISTS source_registry_entries_verification_status_check;
ALTER TABLE source_registry_entries
  ADD CONSTRAINT source_registry_entries_verification_status_check
    CHECK (verification_status IN ('verified', 'catalogued', 'verify_before_enable', 'disabled'));

CREATE INDEX IF NOT EXISTS source_registry_tier_idx ON source_registry_entries (source_tier);
CREATE INDEX IF NOT EXISTS source_registry_jurisdictions_idx
  ON source_registry_entries USING gin (jurisdictions);

-- ---------------------------------------------------------------------------
-- Health + coverage views
-- ---------------------------------------------------------------------------

-- Per-connector operational readiness.
CREATE OR REPLACE VIEW source_registry_health AS
SELECT
  id,
  name,
  source_tier,
  jurisdictions,
  verification_status,
  terms_status,
  robots_policy,
  auth_type,
  (secret_ref IS NOT NULL) AS has_secret_ref,
  eligible,
  enabled,
  disabled_reason,
  last_verified
FROM source_registry_entries;

-- Coverage by jurisdiction (one row per jurisdiction the connector serves).
CREATE OR REPLACE VIEW source_coverage_by_jurisdiction AS
SELECT
  jurisdiction,
  count(*)                                         AS total,
  count(*) FILTER (WHERE enabled)                  AS enabled,
  count(*) FILTER (WHERE verification_status = 'verified')                 AS verified,
  count(*) FILTER (WHERE eligible AND NOT enabled) AS eligible_disabled,
  count(*) FILTER (WHERE verification_status = 'verify_before_enable')     AS verification_pending
FROM source_registry_entries, unnest(jurisdictions) AS jurisdiction
GROUP BY jurisdiction;

-- Coverage by source tier.
CREATE OR REPLACE VIEW source_coverage_by_tier AS
SELECT
  source_tier,
  count(*)                        AS total,
  count(*) FILTER (WHERE enabled) AS enabled,
  count(*) FILTER (WHERE verification_status = 'verified') AS verified
FROM source_registry_entries
GROUP BY source_tier
ORDER BY source_tier;

-- Coverage by verification / enablement status.
CREATE OR REPLACE VIEW source_coverage_by_status AS
SELECT
  verification_status,
  count(*)                              AS total,
  count(*) FILTER (WHERE enabled)       AS enabled,
  count(*) FILTER (WHERE eligible)      AS eligible,
  count(*) FILTER (WHERE NOT eligible)  AS ineligible
FROM source_registry_entries
GROUP BY verification_status;

COMMIT;
