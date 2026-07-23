// CORE-008 (part 2) — canonical evaluation-receipt assembly and verification.
//
// This module turns the evaluator's in-memory proof nodes and score outcome into
// a schema-valid `evaluation-receipt` document, computes the self-describing
// `canonical_hash`, and offers a tamper check. Two invariants drive it:
//
//   1. Byte-identical determinism — the receipt is built from frozen inputs with
//      no wall-clock or randomness, so the canonical JSON and hash are stable
//      across runs. `receiptHash` (from @writ/provenance) canonicalizes per
//      RFC 8785 + §16 and drops the self-referential transport fields.
//
//   2. JSON-safety — proof nodes carry rich runtime values (exact `Decimal`s with
//      BigInt components, united money intervals). Those cannot be canonicalized
//      directly, so every dynamic field is projected to a JSON scalar first,
//      rendering exact decimals as canonical strings.

import { receiptHash } from "@writ/provenance";
import { validate, type Diagnostic, type EvaluationReceipt } from "@writ/domain";
import { formatDecimal, type Decimal } from "./decimal.js";
import type { ProofNode } from "./proof.js";

/** A single schema-clean receipt proof node (a plain JSON object). */
export type ReceiptProofNode = Record<string, unknown>;

/**
 * Project an arbitrary runtime value to a JSON value that canonical JSON accepts:
 * BigInts become decimal strings, exact `Decimal`s render to canonical strings,
 * non-finite numbers become `null`, and `undefined`/functions/symbols are
 * dropped. Deterministic and total.
 */
export function jsonSafe(value: unknown): unknown {
  if (value === null) return null;
  const kind = typeof value;
  if (kind === "string" || kind === "boolean") return value;
  if (kind === "number") return Number.isFinite(value as number) ? value : null;
  if (kind === "bigint") return (value as bigint).toString();
  if (Array.isArray(value)) {
    return value.map(jsonSafe).filter((element) => element !== undefined);
  }
  if (kind === "object") {
    const object = value as Record<string, unknown>;
    if (typeof object.unscaled === "bigint" && typeof object.scale === "number") {
      return formatDecimal(object as unknown as Decimal);
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(object)) {
      const projected = jsonSafe(object[key]);
      if (projected !== undefined) out[key] = projected;
    }
    return out;
  }
  return undefined;
}

/** Convert an internal {@link ProofNode} to a schema-valid receipt proof node. */
export function toReceiptProofNode(node: ProofNode): ReceiptProofNode {
  const out: ReceiptProofNode = {
    id: node.id,
    kind: node.kind,
    label: node.label ?? node.kind,
    truth_value: node.truth_value,
    child_ids: [...node.child_ids],
  };
  if (node.value !== undefined) {
    const value = jsonSafe(node.value);
    if (value !== undefined) out.value = value;
  }
  if (node.value_interval !== undefined) {
    const min = jsonSafe(node.value_interval.min);
    const max = jsonSafe(node.value_interval.max);
    out.value_interval = {
      min: min === undefined ? null : min,
      max: max === undefined ? null : max,
    };
  }
  if (node.rule_id !== undefined) out.rule_id = node.rule_id;
  if (node.action_ids !== undefined) out.action_ids = [...node.action_ids];
  if (node.claim_ids !== undefined) out.claim_ids = [...node.claim_ids];
  if (node.passage_ids !== undefined) out.passage_ids = [...node.passage_ids];
  if (node.metadata !== undefined) {
    const metadata = jsonSafe(node.metadata);
    if (metadata !== undefined && metadata !== null)
      out.metadata = metadata as Record<string, unknown>;
  }
  return out;
}

/** Map an evaluator {@link Diagnostic} to the receipt's diagnostic shape. */
export function toReceiptDiagnostic(diagnostic: Diagnostic): Record<string, unknown> {
  const out: Record<string, unknown> = {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
  };
  const context = mergeContext(diagnostic);
  if (context !== undefined) out.context = context;
  return out;
}

function mergeContext(diagnostic: Diagnostic): Record<string, unknown> | undefined {
  const parts: Record<string, unknown> = {};
  if (diagnostic.context !== undefined) Object.assign(parts, diagnostic.context);
  if (diagnostic.location !== undefined) parts.location = diagnostic.location;
  if (diagnostic.witness !== undefined) parts.witness = diagnostic.witness;
  const safe = jsonSafe(parts);
  if (safe === undefined || safe === null) return undefined;
  return Object.keys(safe as Record<string, unknown>).length > 0
    ? (safe as Record<string, unknown>)
    : undefined;
}

/** Schema validation failure raised when an assembled receipt is not schema-valid. */
export class ReceiptSchemaError extends Error {
  readonly issues: readonly unknown[];
  constructor(issues: readonly unknown[]) {
    super(`Assembled receipt is not schema-valid:\n${JSON.stringify(issues, null, 2)}`);
    this.name = "ReceiptSchemaError";
    this.issues = issues;
  }
}

/**
 * Attach the canonical hash to a receipt-without-hash, then assert it is
 * schema-valid. `receiptHash` drops `/canonical_hash` and `/signature`, so the
 * hash is over exactly the semantic content. The input is validated at runtime,
 * so it is accepted as a plain object rather than the structured type.
 */
export function finalizeReceipt(receipt: Record<string, unknown>): EvaluationReceipt {
  const canonical_hash = receiptHash(receipt);
  const complete = { ...receipt, canonical_hash };
  const result = validate("evaluation-receipt", complete);
  if (!result.valid) throw new ReceiptSchemaError(result.errors);
  return complete as unknown as EvaluationReceipt;
}

/** The outcome of re-checking a receipt's self-describing hash. */
export interface ReceiptVerification {
  readonly valid: boolean;
  /** The hash recomputed from the receipt's current content. */
  readonly expected: string;
  /** The hash the receipt carries. */
  readonly actual: string;
}

/**
 * Recompute a receipt's canonical hash and compare it to the stored value. Any
 * mutation of a semantic field flips `valid` to false (tamper-evident).
 */
export function verifyReceipt(receipt: EvaluationReceipt): ReceiptVerification {
  const expected = receiptHash(receipt);
  const actual = receipt.canonical_hash;
  return { valid: expected === actual, expected, actual };
}
