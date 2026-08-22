/**
 * Content-addressed SHA-256 hashing over RFC 8785 canonical JSON.
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
 * Canonicalize `value` (RFC 8785 + Writ §16 normalization) and return its
 * content hash as `"sha256:<64 lowercase hex>"`.
 */
export function sha256Canonical(value: unknown, options?: HashOptions): string {
  const canonical = canonicalJson(value, options);
  return PREFIX + createHash("sha256").update(canonical, "utf8").digest("hex");
}
