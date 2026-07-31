/**
 * Content-addressed SHA-256 hashing over RFC 8785 canonical JSON.
 *
 * Every hash is `"sha256:" + lowercaseHex(sha256(utf8(canonicalJson(value))))`,
 * matching the `^sha256:[0-9a-f]{64}$` shape used throughout the Writ
 * schemas (see `schemas/analysis/evaluation-receipt.schema.json`,
 * `schemas/analysis/release.schema.json`). Hashing uses Bun's `CryptoHasher`.
 *
 * The named helpers drop the self-referential / volatile envelope fields for
 * their record type before hashing, so that a record's own hash (and its
 * signature over that hash) never feed back into the content identity.
 *
 * Hashing uses `node:crypto`, which is available identically on both Node and
 * Bun, so the whole provenance/evaluator/benchmark stack runs unchanged on a
 * Node (e.g. Vercel) runtime as well as under Bun. SHA-256 output is byte-for-
 * byte identical to Bun's `CryptoHasher` (cross-checked in the tests).
 */

import { createHash } from "node:crypto";

import { canonicalJson, type CanonicalOptions } from "./canonical-json.js";

export type HashOptions = CanonicalOptions;

const PREFIX = "sha256:";

/**
 * Canonicalize `value` (RFC 8785 + Writ §16 normalization) and return its
 * content hash as `"sha256:<64 lowercase hex>"`.
 */
export function sha256Canonical(value: unknown, options?: HashOptions): string {
  const canonical = canonicalJson(value, options);
  return PREFIX + createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Merge a record type's default dropped fields with any caller-supplied ones.
 * Later entries never override earlier ones; the set union is what matters.
 */
function withDefaultDrops(
  defaults: readonly string[],
  options: HashOptions | undefined,
): HashOptions {
  const extra = options?.dropFields === undefined ? [] : Array.from(options.dropFields);
  return { dropFields: [...defaults, ...extra] };
}

/**
 * Self-referential / volatile fields excluded from a receipt's content hash:
 * the receipt's own `canonical_hash` and its `signature` over that hash.
 */
export const RECEIPT_TRANSPORT_FIELDS: readonly string[] = ["/canonical_hash", "/signature"];

/**
 * Self-referential / volatile fields excluded from a release manifest's content
 * hash: the manifest's own `manifest_hash` and its `signature`.
 */
export const RELEASE_MANIFEST_TRANSPORT_FIELDS: readonly string[] = [
  "/manifest_hash",
  "/signature",
];

/**
 * Hash a compiled methodology bundle. The bundle's identity is its full
 * canonical content; pass `dropFields` if a concrete bundle format later gains
 * a self-referential envelope field.
 */
export function methodologyBundleHash(bundle: unknown, options?: HashOptions): string {
  return sha256Canonical(bundle, options);
}

/** Hash an evidence snapshot. Its identity is its full canonical content. */
export function evidenceSnapshotHash(snapshot: unknown, options?: HashOptions): string {
  return sha256Canonical(snapshot, options);
}

/** Hash an interpretation profile. Its identity is its full canonical content. */
export function interpretationProfileHash(profile: unknown, options?: HashOptions): string {
  return sha256Canonical(profile, options);
}

/** Hash an evaluator build descriptor. Its identity is its full canonical content. */
export function evaluatorBuildHash(build: unknown, options?: HashOptions): string {
  return sha256Canonical(build, options);
}

/**
 * Hash an evaluation receipt, excluding its own `canonical_hash` and
 * `signature`. This is the value that populates the receipt's `canonical_hash`.
 */
export function receiptHash(receipt: unknown, options?: HashOptions): string {
  return sha256Canonical(receipt, withDefaultDrops(RECEIPT_TRANSPORT_FIELDS, options));
}

/**
 * Hash a release manifest, excluding its own `manifest_hash` and `signature`.
 * This is the value that populates the manifest's `manifest_hash`.
 */
export function releaseManifestHash(manifest: unknown, options?: HashOptions): string {
  return sha256Canonical(manifest, withDefaultDrops(RELEASE_MANIFEST_TRANSPORT_FIELDS, options));
}
