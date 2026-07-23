// Public surface of @covenant/provenance.
//
// RFC 8785 canonical JSON + SHA-256 content-addressed hashing (task CORE-003).
export { canonicalJson, CanonicalJsonError, type CanonicalOptions } from "./canonical-json.js";

export {
  sha256Canonical,
  methodologyBundleHash,
  evidenceSnapshotHash,
  interpretationProfileHash,
  evaluatorBuildHash,
  receiptHash,
  releaseManifestHash,
  RECEIPT_TRANSPORT_FIELDS,
  RELEASE_MANIFEST_TRANSPORT_FIELDS,
  type HashOptions,
} from "./hash.js";
