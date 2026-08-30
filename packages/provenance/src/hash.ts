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
 * Canonicalize `value` with Writ Canonical JSON v1 and return its content hash
 * as `"sha256:<64 lowercase hex>"`. Existing Writ hashes are pinned to this
 * profile, including NFC normalization and optional pre-canonicalization field
 * omission; this function does not claim complete RFC 8785 conformance.
 */
export function sha256Canonical(value: unknown, options?: HashOptions): string {
  const canonical = canonicalJson(value, options);
  return PREFIX + createHash("sha256").update(canonical, "utf8").digest("hex");
}
