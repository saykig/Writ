/**
 * Content-addressed SHA-256 hashing over Writ Canonical JSON v1.
 *
 * Every hash is `"sha256:" + lowercaseHex(sha256(utf8(canonicalJson(value))))`,
 * matching the `^sha256:[0-9a-f]{64}$` shape used throughout Writ's
 * provenance-bearing contracts. Hashing uses `node:crypto` identically under
 * Node and Bun.
 */

import { createHash } from "node:crypto";

import { canonicalJson, type CanonicalOptions } from "./canonical-json.js";

export type HashOptions = CanonicalOptions;

const PREFIX = "sha256:";

/**
 * Hash the exact UTF-8 bytes of `value` without canonicalization or Unicode
 * normalization. This is the identity operation for quoted passage text.
 */
export function sha256Utf8Text(value: string): string {
  return PREFIX + createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Canonicalize `value` with Writ Canonical JSON v1 and return its content hash
 * as `"sha256:<64 lowercase hex>"`. Existing Writ hashes are pinned to this
 * profile, including NFC normalization and optional pre-canonicalization field
 * omission; this function does not claim complete RFC 8785 conformance.
 */
export function sha256Canonical(value: unknown, options?: HashOptions): string {
  const canonical = canonicalJson(value, options);
  return sha256Utf8Text(canonical);
}
