import { sha256Bytes } from "@writ/provenance";

import { DecisionCaseError } from "./errors.js";

export function decodeBase64Exact(value: string, field: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new DecisionCaseError("DECISION_CASE_INVALID", `${field} is not canonical base64.`);
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) {
    throw new DecisionCaseError("DECISION_CASE_INVALID", `${field} is not canonical base64.`);
  }
  return new Uint8Array(decoded);
}

export function verifyEncodedBytes(
  value: { encoding: string; content: string; sha256: string },
  field: string,
): Uint8Array {
  if (value.encoding !== "base64") {
    throw new DecisionCaseError("DECISION_CASE_INVALID", `${field}.encoding must be base64.`);
  }
  const bytes = decodeBase64Exact(value.content, `${field}.content`);
  if (sha256Bytes(bytes) !== value.sha256) {
    throw new DecisionCaseError(
      "DECISION_CASE_INVALID",
      `${field}.sha256 does not identify the exact decoded bytes.`,
    );
  }
  return bytes;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function exactJson(value: JsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new DecisionCaseError(
        "DECISION_CASE_INVALID",
        "Decision-case envelopes permit only safe integer JSON numbers.",
      );
    }
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(exactJson).join(",")}]`;
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${exactJson(value[key]!)}`);
  return `{${entries.join(",")}}`;
}

/** Exact, non-normalizing JSON bytes for Writ decision-case envelopes. */
export function exactJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${exactJson(value as JsonValue)}\n`);
}

/** Collision-free string key for structured JSON values without Unicode normalization. */
export function exactJsonKey(value: unknown): string {
  return Buffer.from(exactJsonBytes(value)).toString("base64");
}

export function encodedBytes(bytes: Uint8Array): {
  encoding: "base64";
  content: string;
  sha256: string;
} {
  return {
    encoding: "base64",
    content: Buffer.from(bytes).toString("base64"),
    sha256: sha256Bytes(bytes),
  };
}
