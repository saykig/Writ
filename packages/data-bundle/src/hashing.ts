import { sha256Canonical } from "@writ/provenance";

export function hashCanonical(value: unknown): string {
  return sha256Canonical(value);
}

export function serializeBundle(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
