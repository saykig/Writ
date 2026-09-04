import { assertWellFormedUnicode, sha256Bytes } from "./hash.js";

/** Content association only; neither reviewer authentication nor semantic approval. */
export interface ReviewArtifactBinding {
  path: string;
  content_hash: string;
}

export type ReviewArtifactDiagnosticCode =
  | "PROVENANCE_REVIEW_ARTIFACT_BINDING_INVALID"
  | "PROVENANCE_REVIEW_ARTIFACT_PATH_INVALID"
  | "PROVENANCE_REVIEW_ARTIFACT_HASH_INVALID"
  | "PROVENANCE_REVIEW_ARTIFACT_BYTES_UNAVAILABLE"
  | "PROVENANCE_REVIEW_ARTIFACT_BYTES_INVALID"
  | "PROVENANCE_REVIEW_ARTIFACT_HASH_MISMATCH"
  | "PROVENANCE_REVIEW_ARTIFACT_NOT_FOUND"
  | "PROVENANCE_REVIEW_ARTIFACT_NOT_TRACKED"
  | "PROVENANCE_REVIEW_ARTIFACT_INVENTORY_UNAVAILABLE"
  | "PROVENANCE_REVIEW_ARTIFACT_NOT_REGULAR_FILE"
  | "PROVENANCE_REVIEW_ARTIFACT_PATH_ALIAS"
  | "PROVENANCE_REVIEW_ARTIFACT_SELF_REFERENCE"
  | "PROVENANCE_REVIEW_ARTIFACT_READ_FAILED";

export interface ReviewArtifactDiagnostic {
  code: ReviewArtifactDiagnosticCode;
  message: string;
}

export type ReviewArtifactVerification =
  | { status: "verified"; binding: ReviewArtifactBinding; diagnostics: [] }
  | {
      status: "unavailable";
      binding: ReviewArtifactBinding;
      diagnostics: ReviewArtifactDiagnostic[];
    }
  | { status: "invalid"; diagnostics: ReviewArtifactDiagnostic[] };

function invalid(code: ReviewArtifactDiagnosticCode, message: string): ReviewArtifactVerification {
  return { status: "invalid", diagnostics: [{ code, message }] };
}

/** A canonical repository-relative POSIX locator; never normalize an input alias. */
export function isReviewArtifactPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    assertWellFormedUnicode(value, "path");
  } catch {
    return false;
  }
  return (
    !/[\\:%]/.test(value) &&
    ![...value].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) &&
    value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

/**
 * Verify exact caller-supplied bytes. Missing bytes are explicitly unavailable,
 * never verified. Empty bytes are valid content and make no claim about review.
 * This function performs no filesystem access or canonicalization.
 */
export function verifyReviewArtifact(
  input: unknown,
  bytes?: Uint8Array,
): ReviewArtifactVerification {
  let path: unknown;
  let contentHash: unknown;
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      return invalid("PROVENANCE_REVIEW_ARTIFACT_BINDING_INVALID", "Binding must be one object.");
    }
    const prototype = Object.getPrototypeOf(input);
    const keys = Reflect.ownKeys(input);
    const pathProperty = Object.getOwnPropertyDescriptor(input, "path");
    const hashProperty = Object.getOwnPropertyDescriptor(input, "content_hash");
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.length !== 2 ||
      !keys.includes("path") ||
      !keys.includes("content_hash") ||
      !pathProperty ||
      !("value" in pathProperty) ||
      !pathProperty.enumerable ||
      !hashProperty ||
      !("value" in hashProperty) ||
      !hashProperty.enumerable
    ) {
      return invalid(
        "PROVENANCE_REVIEW_ARTIFACT_BINDING_INVALID",
        "Binding must contain exactly the own data properties path and content_hash.",
      );
    }
    path = pathProperty.value;
    contentHash = hashProperty.value;
  } catch {
    return invalid("PROVENANCE_REVIEW_ARTIFACT_BINDING_INVALID", "Binding is not plain data.");
  }
  if (!isReviewArtifactPath(path)) {
    return invalid(
      "PROVENANCE_REVIEW_ARTIFACT_PATH_INVALID",
      "Review artifact path must be canonical and repository-relative without alias segments.",
    );
  }
  if (
    typeof contentHash !== "string" ||
    contentHash.length !== 71 ||
    !/^sha256:[0-9a-f]{64}$/.test(contentHash)
  ) {
    return invalid(
      "PROVENANCE_REVIEW_ARTIFACT_HASH_INVALID",
      "Review artifact content_hash must use sha256 and 64 lowercase hexadecimal digits.",
    );
  }
  const binding = { path, content_hash: contentHash };
  if (bytes === undefined) {
    return {
      status: "unavailable",
      binding,
      diagnostics: [
        {
          code: "PROVENANCE_REVIEW_ARTIFACT_BYTES_UNAVAILABLE",
          message:
            "Expected review artifact identity is declared, but exact bytes are unavailable.",
        },
      ],
    };
  }
  if (!ArrayBuffer.isView(bytes) || !(bytes instanceof Uint8Array)) {
    return invalid(
      "PROVENANCE_REVIEW_ARTIFACT_BYTES_INVALID",
      "Artifact bytes must be Uint8Array.",
    );
  }
  const actualHash = sha256Bytes(bytes);
  if (actualHash !== contentHash) {
    return invalid(
      "PROVENANCE_REVIEW_ARTIFACT_HASH_MISMATCH",
      `Review artifact bytes hash to ${actualHash}, not ${contentHash}.`,
    );
  }
  return { status: "verified", binding, diagnostics: [] };
}
