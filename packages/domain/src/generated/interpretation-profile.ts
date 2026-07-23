/* eslint-disable */
/**
 * This file was automatically generated from the vendored JSON Schema.
 * Do not edit by hand. Regenerate with `bun run generate` in packages/domain.
 */

export interface InterpretationProfile {
  schema_version: "1.0.0";
  id: string;
  name: string;
  version: string;
  methodology_bundle_hash: string;
  parameters: {};
  decisions: {
    id: string;
    question: string;
    choice: unknown;
    alternatives_considered?: unknown[];
    rationale: string;
    source_passage_ids?: string[];
    status: "proposed" | "accepted" | "contested" | "superseded";
    approved_by?: string[];
    approved_at?: string;
  }[];
  waivers: {
    diagnostic_code: string;
    object_id: string;
    rationale: string;
    approved_by: string;
    expires_at?: string;
  }[];
  status: "draft" | "review" | "approved" | "withdrawn";
  created_at?: string;
  created_by?: string;
  canonical_hash: string;
  signature?: {};
}
