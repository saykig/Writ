BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE source_registry_entries (
  id text PRIMARY KEY,
  body jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (verification_status IN ('unverified', 'partially_verified', 'verified', 'deprecated'))
);

CREATE TABLE documents (
  id text PRIMARY KEY,
  source_registry_id text REFERENCES source_registry_entries(id),
  canonical_uri text NOT NULL,
  publisher text,
  jurisdiction text,
  document_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_versions (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES documents(id),
  retrieved_at timestamptz NOT NULL,
  issued_at timestamptz,
  media_type text NOT NULL,
  byte_size bigint,
  sha256 text NOT NULL UNIQUE,
  storage_uri text NOT NULL,
  warc_record_id text,
  http_status integer,
  response_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  extraction_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sha256 ~ '^sha256:[0-9a-f]{64}$')
);
CREATE INDEX document_versions_document_time_idx ON document_versions(document_id, retrieved_at DESC);

CREATE TABLE passages (
  id text PRIMARY KEY,
  document_version_id text NOT NULL REFERENCES document_versions(id),
  anchor_type text NOT NULL,
  page_number integer,
  anchor jsonb NOT NULL,
  quote text NOT NULL,
  normalized_quote text NOT NULL,
  anchor_hash text NOT NULL,
  language text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_version_id, anchor_hash)
);
CREATE INDEX passages_document_idx ON passages(document_version_id);
CREATE INDEX passages_fts_idx ON passages USING gin(to_tsvector('simple', normalized_quote));

CREATE TABLE methodology_bundles (
  id text PRIMARY KEY,
  package_name text NOT NULL,
  package_version text NOT NULL,
  language_version text NOT NULL,
  canonical_ir jsonb NOT NULL,
  canonical_hash text NOT NULL UNIQUE,
  source_bundle_hash text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE(package_name, package_version),
  CHECK (status IN ('draft', 'review', 'published', 'withdrawn'))
);

CREATE TABLE interpretation_profiles (
  id text PRIMARY KEY,
  methodology_bundle_id text NOT NULL REFERENCES methodology_bundles(id),
  name text NOT NULL,
  version text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  waivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  canonical_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(methodology_bundle_id, name, version)
);

CREATE TABLE evidence_snapshots (
  id text PRIMARY KEY,
  frozen_at timestamptz NOT NULL,
  cutoff timestamptz NOT NULL,
  content_hash text NOT NULL UNIQUE,
  description text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE snapshot_document_versions (
  snapshot_id text NOT NULL REFERENCES evidence_snapshots(id),
  document_version_id text NOT NULL REFERENCES document_versions(id),
  PRIMARY KEY(snapshot_id, document_version_id)
);

CREATE TABLE claims (
  id text PRIMARY KEY,
  claim_type text NOT NULL,
  subject_ref text NOT NULL,
  predicate text NOT NULL,
  object_value jsonb NOT NULL,
  qualifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  truth_value text NOT NULL,
  status text NOT NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  recorded_at timestamptz NOT NULL,
  origin text NOT NULL,
  created_by text,
  supersedes_claim_id text REFERENCES claims(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (truth_value IN ('true', 'false', 'unknown', 'contested')),
  CHECK (status IN ('candidate', 'accepted', 'rejected', 'contested', 'superseded', 'withdrawn')),
  CHECK (origin IN ('human', 'extractor', 'model', 'import')),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);
CREATE INDEX claims_subject_predicate_idx ON claims(subject_ref, predicate, status);
CREATE INDEX claims_recorded_idx ON claims(recorded_at);

CREATE TABLE claim_evidence_links (
  claim_id text NOT NULL REFERENCES claims(id),
  passage_id text NOT NULL REFERENCES passages(id),
  stance text NOT NULL,
  support_type text NOT NULL,
  PRIMARY KEY(claim_id, passage_id, stance),
  CHECK (stance IN ('supports', 'contradicts', 'qualifies')),
  CHECK (support_type IN ('direct', 'derived', 'contextual', 'negative_search'))
);

CREATE TABLE actions (
  id text PRIMARY KEY,
  label text NOT NULL,
  jurisdiction text NOT NULL,
  kind text NOT NULL,
  instrument_type text,
  implementation_stage text NOT NULL,
  beneficiary_targeting text NOT NULL,
  durability text,
  attribution text NOT NULL,
  announcement_time timestamptz,
  valid_from timestamptz,
  valid_to timestamptz,
  program_family_id text,
  underlying_instrument_id text,
  status text NOT NULL,
  structured_body jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('candidate', 'accepted', 'rejected', 'contested', 'superseded'))
);
CREATE INDEX actions_jurisdiction_time_idx ON actions(jurisdiction, announcement_time);
CREATE INDEX actions_identity_idx ON actions(underlying_instrument_id, program_family_id);

CREATE TABLE action_claims (
  action_id text NOT NULL REFERENCES actions(id),
  claim_id text NOT NULL REFERENCES claims(id),
  PRIMARY KEY(action_id, claim_id)
);

CREATE TABLE action_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_action_id text NOT NULL REFERENCES actions(id),
  relationship_type text NOT NULL,
  target_action_id text NOT NULL REFERENCES actions(id),
  supporting_claim_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'candidate',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_action_id, relationship_type, target_action_id)
);

CREATE TABLE reviews (
  id text PRIMARY KEY,
  object_type text NOT NULL,
  object_id text NOT NULL,
  reviewer_id text NOT NULL,
  decision text NOT NULL,
  rationale text NOT NULL,
  conflict_of_interest text,
  supersedes_review_id text REFERENCES reviews(id),
  created_at timestamptz NOT NULL,
  CHECK (decision IN ('accept', 'reject', 'contest', 'request_changes', 'approve', 'withdraw'))
);
CREATE INDEX reviews_object_idx ON reviews(object_type, object_id, created_at DESC);

CREATE TABLE evaluation_runs (
  id text PRIMARY KEY,
  methodology_bundle_id text NOT NULL REFERENCES methodology_bundles(id),
  interpretation_profile_id text NOT NULL REFERENCES interpretation_profiles(id),
  evidence_snapshot_id text NOT NULL REFERENCES evidence_snapshots(id),
  commitment_id text NOT NULL,
  subject_id text NOT NULL,
  as_of timestamptz NOT NULL,
  cutoff timestamptz NOT NULL,
  evaluator_build_hash text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(methodology_bundle_id, interpretation_profile_id, evidence_snapshot_id, commitment_id, subject_id, evaluator_build_hash)
);

CREATE TABLE evaluation_receipts (
  id text PRIMARY KEY,
  evaluation_run_id text NOT NULL UNIQUE REFERENCES evaluation_runs(id),
  result text NOT NULL,
  result_status text NOT NULL,
  receipt jsonb NOT NULL,
  canonical_hash text NOT NULL UNIQUE,
  signature jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (result IN ('-1', '0', '+1', 'not_applicable', 'unresolved')),
  CHECK (result_status IN ('supported', 'contested', 'incomplete', 'ambiguous', 'invalid'))
);

CREATE TABLE discrepancies (
  id text PRIMARY KEY,
  benchmark_reference text NOT NULL,
  commitment_id text NOT NULL,
  subject_id text NOT NULL,
  published_result text NOT NULL,
  computed_result text NOT NULL,
  category text NOT NULL,
  summary text NOT NULL,
  details text,
  blocking boolean NOT NULL,
  resolution_status text NOT NULL,
  linked_objects jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE releases (
  id text PRIMARY KEY,
  name text NOT NULL,
  version text NOT NULL,
  methodology_bundle_ids jsonb NOT NULL,
  evidence_snapshot_ids jsonb NOT NULL,
  receipt_ids jsonb NOT NULL,
  manifest jsonb NOT NULL,
  canonical_hash text NOT NULL UNIQUE,
  signature jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE(name, version)
);

CREATE TABLE audit_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id text NOT NULL,
  event_type text NOT NULL,
  object_type text NOT NULL,
  object_id text NOT NULL,
  prior_hash text,
  event_hash text NOT NULL UNIQUE,
  payload jsonb NOT NULL
);


CREATE TABLE negative_search_protocols (
  id text PRIMARY KEY,
  commitment_id text NOT NULL,
  subject_id text NOT NULL,
  cutoff timestamptz NOT NULL,
  body jsonb NOT NULL,
  content_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('draft', 'review', 'accepted', 'rejected', 'contested'))
);

CREATE TABLE challenges (
  id text PRIMARY KEY,
  object_type text NOT NULL,
  object_id text NOT NULL,
  submitted_by text NOT NULL,
  summary text NOT NULL,
  details text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (status IN ('open', 'triaged', 'under_review', 'resolved', 'rejected', 'withdrawn'))
);
CREATE INDEX challenges_object_idx ON challenges(object_type, object_id, status);

COMMIT;
