// Append-only audit log. Rows are immutable (enforced by trigger).
import type { DbClient } from "../client.js";
import type { AuditEventInput, AuditEventRow } from "../types.js";
import { json, maybe, one } from "./shared.js";

export function auditRepository(sql: DbClient) {
  return {
    async append(input: AuditEventInput): Promise<AuditEventRow> {
      const rows = await sql<AuditEventRow[]>`
        INSERT INTO audit_events (
          occurred_at, actor_id, event_type, object_type, object_id,
          prior_hash, event_hash, payload
        ) VALUES (
          COALESCE(${input.occurred_at ?? null}, now()), ${input.actor_id}, ${input.event_type},
          ${input.object_type}, ${input.object_id}, ${input.prior_hash ?? null},
          ${input.event_hash}, ${json(sql, input.payload)}
        )
        RETURNING *`;
      return one(rows, "audit_event");
    },

    async latest(): Promise<AuditEventRow | null> {
      return maybe(
        await sql<AuditEventRow[]>`SELECT * FROM audit_events ORDER BY sequence DESC LIMIT 1`,
      );
    },

    async listForObject(objectType: string, objectId: string): Promise<AuditEventRow[]> {
      return sql<AuditEventRow[]>`
        SELECT * FROM audit_events
        WHERE object_type = ${objectType} AND object_id = ${objectId}
        ORDER BY sequence ASC`;
    },
  };
}

export type AuditRepository = ReturnType<typeof auditRepository>;
