// Immutable audit trail for every accepted transition.
//
// AGENTS.md: "every transition emits an immutable audit event." Each event binds
// to the previous one through a content-hash chain: `event_hash` is the
// canonical hash of the event's semantic content plus the `prior_hash` of the
// current chain head. Because the prior hash is folded in, even two otherwise
// identical events get distinct hashes, and any gap or reordering is detectable.
// Hashing is deterministic (no wall-clock): the DB assigns `occurred_at`, which
// is excluded from the content that is hashed.

import { sha256Canonical } from "@covenant/provenance";
import type { AuditRepository } from "../db/repositories/audit.js";
import type { AuditEventRow, JsonObject } from "../db/types.js";

export interface AuditWrite {
  readonly actorId: string;
  readonly eventType: string;
  readonly objectType: string;
  readonly objectId: string;
  readonly payload: JsonObject;
}

/** The content that defines an audit event's identity (excludes volatile `occurred_at`). */
function auditContent(input: AuditWrite, priorHash: string | null): unknown {
  return {
    actor_id: input.actorId,
    event_type: input.eventType,
    object_type: input.objectType,
    object_id: input.objectId,
    payload: input.payload,
    prior_hash: priorHash,
  };
}

/**
 * Append an audit event to the tamper-evident chain. Reads the current head,
 * computes the linked `event_hash`, and inserts an append-only row.
 */
export async function appendAuditEvent(
  audit: AuditRepository,
  input: AuditWrite,
): Promise<AuditEventRow> {
  const head = await audit.latest();
  const priorHash = head?.event_hash ?? null;
  const eventHash = sha256Canonical(auditContent(input, priorHash));
  return audit.append({
    actor_id: input.actorId,
    event_type: input.eventType,
    object_type: input.objectType,
    object_id: input.objectId,
    payload: input.payload,
    event_hash: eventHash,
    ...(priorHash !== null ? { prior_hash: priorHash } : {}),
  });
}
