// Public surface of @writ/provenance.
//
// Writ Canonical JSON v1 + SHA-256 content-addressed hashing. The profile reuses
// JCS serialization rules but adds NFC normalization and declared field omission,
// so the complete algorithm is not plain RFC 8785/JCS.
export { canonicalJson, CanonicalJsonError, type CanonicalOptions } from "./canonical-json.js";

export { sha256Canonical, type HashOptions } from "./hash.js";
