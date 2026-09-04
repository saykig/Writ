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

/** Hash exact binary bytes without decoding, normalization, or canonicalization. */
export function sha256Bytes(value: Uint8Array): string {
  if (!ArrayBuffer.isView(value) || !(value instanceof Uint8Array))
    throw new TypeError("Exact byte hashing requires Uint8Array.");
  return PREFIX + createHash("sha256").update(value).digest("hex");
}

/** Error thrown when a portable string contract receives ill-formed Unicode. */
export class IllFormedUnicodeError extends Error {
  constructor(
    readonly index: number,
    readonly field = "text",
  ) {
    super(`ill-formed Unicode in ${field}: unpaired surrogate at UTF-16 index ${index}`);
    this.name = "IllFormedUnicodeError";
  }
}

/** Reject unpaired UTF-16 surrogate code units without changing valid text. */
export function assertWellFormedUnicode(value: string, field = "text"): void {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || next < 0xdc00 || next > 0xdfff) {
        throw new IllFormedUnicodeError(index, field);
      }
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new IllFormedUnicodeError(index, field);
    }
  }
}

/**
 * Hash the exact UTF-8 bytes of `value` without canonicalization or Unicode
 * normalization. This is the identity operation for quoted passage text.
 */
export function sha256Utf8Text(value: string): string {
  assertWellFormedUnicode(value, "text");
  return PREFIX + createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Canonicalize `value` with Writ Canonical JSON v1 and return its content hash
 * as `"sha256:<64 lowercase hex>"`. Existing Writ hashes are pinned to this
 * profile, including NFC normalization and optional pre-canonicalization field
 * omission; this function does not claim complete RFC 8785 conformance.
 * The result identifies the in-memory Writ value/profile, not the bytes of a
 * source document or arbitrary serialized input.
 */
export function sha256Canonical(value: unknown, options?: HashOptions): string {
  const canonical = canonicalJson(value, options);
  return sha256Utf8Text(canonical);
}
