/* eslint-disable */
/**
 * This file was automatically generated from the vendored JSON Schema.
 * Do not edit by hand. Regenerate with `bun run generate` in packages/domain.
 */

export interface Release {
  schema_version: "1.0.0";
  id: string;
  name: string;
  version: string;
  status: "draft" | "candidate" | "published" | "withdrawn";
  created_at: string;
  published_at?: string;
  created_by?: string;
  evaluator_build_hash: string;
  /**
   * @minItems 1
   */
  methodology_bundles: [Dependency, ...Dependency[]];
  /**
   * @minItems 1
   */
  interpretation_profiles: [Dependency, ...Dependency[]];
  /**
   * @minItems 1
   */
  evidence_snapshots: [Dependency, ...Dependency[]];
  receipts: Dependency[];
  discrepancies: Dependency[];
  source_objects: Dependency[];
  aggregate_outputs?: {
    id: string;
    media_type: string;
    hash: string;
    uri?: string;
  }[];
  validation?: {
    schema_valid?: boolean;
    conformance_passed?: boolean;
    unwaived_error_count?: number;
    blocking_discrepancy_count?: number;
    reproducibility_verified?: boolean;
  };
  manifest_hash: string;
  signature?: {};
  withdrawal_reason?: string;
}
export interface Dependency {
  id: string;
  hash: string;
  uri?: string;
}
