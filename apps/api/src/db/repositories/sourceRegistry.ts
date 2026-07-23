// DATA-004 source registry service.
//
// Imports the source-registry seed, enforces the verification gate, and exposes
// health + coverage. The gate decides ENABLEMENT independently of the seed's
// `enabled` flag: a connector is enabled only when every operational-readiness
// requirement is met AND the operator requested it. Anything incomplete stays
// disabled with a recorded reason.
//
// Secrets are REFERENCED, never stored: only `authentication.secret_ref` (a
// handle such as `env:US_CONGRESS_API_KEY`) is persisted; raw secret material is
// stripped from the body before it is written.
import type { DbClient } from "../client.js";
import type { Queryable } from "./shared.js";
import { json, withTransaction } from "./shared.js";

export interface RegistryAuthentication {
  type: "none" | "api_key" | "oauth2" | "basic" | "session" | "licensed";
  secret_ref?: string;
  notes?: string;
}

export interface RegistryEntry {
  id: string;
  name: string;
  publisher?: string;
  jurisdictions: string[];
  issue_areas?: string[];
  source_tier: number;
  source_types: string[];
  base_uri: string;
  api_spec_uri?: string;
  discovery_method: string;
  fetch_method: string;
  authentication?: RegistryAuthentication;
  robots_policy?: "respect" | "api_only" | "manual_review" | "not_applicable";
  terms_status?: "reviewed" | "review_required" | "restricted" | "unknown";
  languages?: string[];
  expected_formats?: string[];
  connector?: string;
  enabled: boolean;
  verification_status: "verified" | "catalogued" | "verify_before_enable" | "disabled";
  last_verified?: string;
  notes?: string;
  // Tolerate unexpected keys so sanitisation can strip rogue secret material.
  [key: string]: unknown;
}

export interface RegistryDocument {
  schema_version: string;
  generated_at?: string;
  entries: RegistryEntry[];
}

export interface EnablementDecision {
  /** True when every operational-readiness requirement is satisfied. */
  eligible: boolean;
  /** True when the connector is eligible AND the operator requested enablement. */
  enabled: boolean;
  /** Gate failures (endpoint, authority, license/rights, retention, identifier/parser, secret). */
  reasons: string[];
  /** Why the connector is not enabled, or null when it is. */
  disabledReason: string | null;
}

const ROBOTS_OK = new Set(["respect", "api_only", "not_applicable"]);

/**
 * The verification gate. Pure and independently testable.
 *
 * Required fields, mapped to the seed registry:
 *   - endpoint            -> base_uri present
 *   - authority           -> at least one jurisdiction
 *   - license / rights    -> terms_status = reviewed
 *   - retention / access  -> robots_policy is respect / api_only / not_applicable
 *   - identifier + parser -> verification_status = verified (verification requires
 *                            stable identifiers and a proven parser fixture)
 *   - secret reference    -> non-`none` auth must carry a secret_ref handle
 */
export function evaluateEnablement(entry: RegistryEntry): EnablementDecision {
  const reasons: string[] = [];

  if (typeof entry.base_uri !== "string" || entry.base_uri.trim() === "") {
    reasons.push("missing_endpoint");
  }
  if (!Array.isArray(entry.jurisdictions) || entry.jurisdictions.length === 0) {
    reasons.push("missing_authority");
  }
  if (entry.verification_status !== "verified") {
    reasons.push("not_verified");
  }
  if (entry.terms_status !== "reviewed") {
    reasons.push("license_or_terms_not_reviewed");
  }
  if (entry.robots_policy !== undefined && !ROBOTS_OK.has(entry.robots_policy)) {
    reasons.push("access_policy_requires_manual_review");
  }
  const auth = entry.authentication ?? { type: "none" as const };
  if (auth.type !== "none" && (typeof auth.secret_ref !== "string" || auth.secret_ref === "")) {
    reasons.push("missing_secret_reference");
  }

  const eligible = reasons.length === 0;
  const requested = entry.enabled === true;
  const enabled = eligible && requested;

  let disabledReason: string | null = null;
  if (!enabled) {
    if (!eligible) {
      disabledReason = reasons.join(",");
    } else {
      disabledReason = "operator_disabled";
    }
  }

  return { eligible, enabled, reasons, disabledReason };
}

const SECRET_KEY =
  /^(secret|token|password|passwd|api[_-]?key|apikey|client_secret|access_key|secret_key|private_key|credential)s?$/i;

function stripSecrets(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) stripSecrets(item);
    return;
  }
  if (node !== null && typeof node === "object") {
    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key === "secret_ref") continue; // a reference handle, not a secret
      if (SECRET_KEY.test(key)) {
        delete record[key];
        continue;
      }
      stripSecrets(record[key]);
    }
  }
}

/** Return the body to persist (raw secrets removed) and the secret reference handle. */
export function sanitizeEntry(entry: RegistryEntry): {
  body: Record<string, unknown>;
  secretRef: string | null;
} {
  const secretRef = entry.authentication?.secret_ref ?? null;
  const body = structuredClone(entry) as Record<string, unknown>;
  stripSecrets(body);
  return { body, secretRef };
}

export interface ImportSummary {
  total: number;
  imported: number;
  enabled: number;
  eligible: number;
  verificationPending: number;
  disabled: number;
}

async function importEntry(client: Queryable, entry: RegistryEntry): Promise<EnablementDecision> {
  const decision = evaluateEnablement(entry);
  const { body, secretRef } = sanitizeEntry(entry);
  await client`
    INSERT INTO source_registry_entries (
      id, body, name, publisher, jurisdictions, source_tier, source_types,
      base_uri, discovery_method, fetch_method, auth_type, secret_ref,
      terms_status, robots_policy, verification_status, eligible, enabled,
      disabled_reason, last_verified, updated_at
    ) VALUES (
      ${entry.id}, ${json(client, body)}, ${entry.name ?? null}, ${entry.publisher ?? null},
      ${entry.jurisdictions ?? []}, ${entry.source_tier ?? null}, ${entry.source_types ?? []},
      ${entry.base_uri ?? null}, ${entry.discovery_method ?? null}, ${entry.fetch_method ?? null},
      ${entry.authentication?.type ?? null}, ${secretRef}, ${entry.terms_status ?? null},
      ${entry.robots_policy ?? null}, ${entry.verification_status}, ${decision.eligible},
      ${decision.enabled}, ${decision.disabledReason}, ${entry.last_verified ?? null}, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      body = EXCLUDED.body,
      name = EXCLUDED.name,
      publisher = EXCLUDED.publisher,
      jurisdictions = EXCLUDED.jurisdictions,
      source_tier = EXCLUDED.source_tier,
      source_types = EXCLUDED.source_types,
      base_uri = EXCLUDED.base_uri,
      discovery_method = EXCLUDED.discovery_method,
      fetch_method = EXCLUDED.fetch_method,
      auth_type = EXCLUDED.auth_type,
      secret_ref = EXCLUDED.secret_ref,
      terms_status = EXCLUDED.terms_status,
      robots_policy = EXCLUDED.robots_policy,
      verification_status = EXCLUDED.verification_status,
      eligible = EXCLUDED.eligible,
      enabled = EXCLUDED.enabled,
      disabled_reason = EXCLUDED.disabled_reason,
      last_verified = EXCLUDED.last_verified,
      updated_at = now()`;
  return decision;
}

export interface RegistryHealthRow {
  id: string;
  name: string | null;
  source_tier: number | null;
  jurisdictions: string[];
  verification_status: string;
  terms_status: string | null;
  robots_policy: string | null;
  auth_type: string | null;
  has_secret_ref: boolean;
  eligible: boolean;
  enabled: boolean;
  disabled_reason: string | null;
  last_verified: Date | null;
}

export function sourceRegistryRepository(sql: DbClient) {
  return {
    evaluateEnablement,
    sanitizeEntry,

    /** Import one entry (upsert). Returns the enablement decision. */
    async importEntry(entry: RegistryEntry): Promise<EnablementDecision> {
      return importEntry(sql, entry);
    },

    /** Import a full registry document in a single transaction. */
    async importRegistry(doc: RegistryDocument): Promise<ImportSummary> {
      return withTransaction(sql, async (tx) => {
        const summary: ImportSummary = {
          total: doc.entries.length,
          imported: 0,
          enabled: 0,
          eligible: 0,
          verificationPending: 0,
          disabled: 0,
        };
        for (const entry of doc.entries) {
          const decision = await importEntry(tx, entry);
          summary.imported += 1;
          if (decision.enabled) summary.enabled += 1;
          else summary.disabled += 1;
          if (decision.eligible) summary.eligible += 1;
          if (entry.verification_status === "verify_before_enable") {
            summary.verificationPending += 1;
          }
        }
        return summary;
      });
    },

    async getEntry(id: string): Promise<RegistryHealthRow | null> {
      const rows = await sql<RegistryHealthRow[]>`
        SELECT * FROM source_registry_health WHERE id = ${id}`;
      return rows[0] ?? null;
    },

    async health(): Promise<RegistryHealthRow[]> {
      return sql<RegistryHealthRow[]>`SELECT * FROM source_registry_health ORDER BY id`;
    },

    async listEnabled(): Promise<RegistryHealthRow[]> {
      return sql<RegistryHealthRow[]>`
        SELECT * FROM source_registry_health WHERE enabled ORDER BY id`;
    },

    async coverageByJurisdiction() {
      return sql`SELECT * FROM source_coverage_by_jurisdiction ORDER BY jurisdiction`;
    },

    async coverageByTier() {
      return sql`SELECT * FROM source_coverage_by_tier ORDER BY source_tier`;
    },

    async coverageByStatus() {
      return sql`SELECT * FROM source_coverage_by_status ORDER BY verification_status`;
    },
  };
}

export type SourceRegistryRepository = ReturnType<typeof sourceRegistryRepository>;
