/* eslint-disable */
/**
 * This file was automatically generated from the vendored JSON Schema.
 * Do not edit by hand. Regenerate with `bun run generate` in packages/domain.
 */

export interface SourceRegistry {
  schema_version: "1.0.0";
  generated_at?: string;
  entries: Entry[];
}
export interface Entry {
  id: string;
  name: string;
  publisher?: string;
  /**
   * @minItems 1
   */
  jurisdictions: [string, ...string[]];
  issue_areas?: string[];
  source_tier: number;
  /**
   * @minItems 1
   */
  source_types: [
    (
      | "commitment"
      | "methodology"
      | "evaluation"
      | "executive"
      | "law"
      | "regulation"
      | "budget"
      | "spending"
      | "procurement"
      | "grant"
      | "parliament"
      | "audit"
      | "statistics"
      | "open_data"
      | "international_organization"
      | "media"
      | "research"
      | "archive"
      | "search"
    ),
    ...(
      | "commitment"
      | "methodology"
      | "evaluation"
      | "executive"
      | "law"
      | "regulation"
      | "budget"
      | "spending"
      | "procurement"
      | "grant"
      | "parliament"
      | "audit"
      | "statistics"
      | "open_data"
      | "international_organization"
      | "media"
      | "research"
      | "archive"
      | "search"
    )[],
  ];
  base_uri: string;
  api_spec_uri?: string;
  discovery_method:
    | "api"
    | "rss"
    | "atom"
    | "sitemap"
    | "crawl"
    | "search"
    | "bulk_download"
    | "manual"
    | "hybrid"
    | "licensed_feed";
  fetch_method: "http" | "api" | "browser" | "bulk_download" | "manual" | "licensed_feed";
  authentication?: {
    type: "none" | "api_key" | "oauth2" | "basic" | "session" | "licensed";
    secret_ref?: string;
    notes?: string;
  };
  rate_limit?: {
    requests?: number;
    period_seconds?: number;
    concurrency?: number;
  };
  crawl_schedule?: string;
  robots_policy?: "respect" | "api_only" | "manual_review" | "not_applicable";
  terms_status?: "reviewed" | "review_required" | "restricted" | "unknown";
  languages?: string[];
  expected_formats?: string[];
  connector?: string;
  enabled: boolean;
  verification_status: "verified" | "catalogued" | "verify_before_enable" | "disabled";
  last_verified?: string;
  notes?: string;
}
