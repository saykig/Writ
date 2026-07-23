// Actions (bitemporal) and typed relationships between them.
import type { DbClient } from "../client.js";
import type {
  ActionInput,
  ActionRelationshipInput,
  ActionRow,
  ActionStatus,
} from "../types.js";
import { json, maybe, one, withTransaction } from "./shared.js";

export interface ActionSupersedeResult {
  superseded: ActionRow;
  replacement: ActionRow;
}

export function actionsRepository(sql: DbClient) {
  async function insert(input: ActionInput): Promise<ActionRow> {
    const rows = await sql<ActionRow[]>`
      INSERT INTO actions (
        id, logical_id, label, actors, jurisdiction, kind, instrument_type,
        implementation_stage, beneficiary_targeting, durability, attribution,
        announcement_time, valid_from, valid_to, program_family_id,
        underlying_instrument_id, status, structured_body
      ) VALUES (
        ${input.id}, ${input.logical_id ?? null}, ${input.label},
        ${json(sql, input.actors ?? [])}, ${input.jurisdiction}, ${input.kind},
        ${input.instrument_type ?? null}, ${input.implementation_stage},
        ${input.beneficiary_targeting}, ${input.durability ?? null}, ${input.attribution},
        ${input.announcement_time ?? null}, ${input.valid_from ?? null},
        ${input.valid_to ?? null}, ${input.program_family_id ?? null},
        ${input.underlying_instrument_id ?? null}, ${input.status},
        ${json(sql, input.structured_body ?? {})}
      )
      RETURNING *`;
    return one(rows, "action");
  }

  return {
    insert,

    async get(id: string): Promise<ActionRow | null> {
      return maybe(await sql<ActionRow[]>`SELECT * FROM actions WHERE id = ${id}`);
    },

    async currentByLogicalId(logicalId: string): Promise<ActionRow | null> {
      return maybe(
        await sql<ActionRow[]>`
          SELECT * FROM actions WHERE logical_id = ${logicalId} AND system_to IS NULL`,
      );
    },

    async listByJurisdiction(jurisdiction: string): Promise<ActionRow[]> {
      return sql<ActionRow[]>`
        SELECT * FROM actions
        WHERE jurisdiction = ${jurisdiction}
        ORDER BY announcement_time DESC NULLS LAST`;
    },

    async supersede(
      oldActionId: string,
      replacement: ActionInput,
      options: { status?: ActionStatus } = {},
    ): Promise<ActionSupersedeResult> {
      const actors = json(sql, replacement.actors ?? []);
      const structuredBody = json(sql, replacement.structured_body ?? {});
      const newStatus = options.status ?? "accepted";

      return withTransaction(sql, async (tx) => {
        const old = one(
          await tx<ActionRow[]>`SELECT * FROM actions WHERE id = ${oldActionId} FOR UPDATE`,
          "action",
        );
        await tx`
          UPDATE actions SET status = 'superseded', system_to = now()
          WHERE id = ${oldActionId}`;
        const insertedRows = await tx<ActionRow[]>`
          INSERT INTO actions (
            id, logical_id, label, actors, jurisdiction, kind, instrument_type,
            implementation_stage, beneficiary_targeting, durability, attribution,
            announcement_time, valid_from, valid_to, program_family_id,
            underlying_instrument_id, status, structured_body
          ) VALUES (
            ${replacement.id}, ${replacement.logical_id ?? old.logical_id}, ${replacement.label},
            ${actors}, ${replacement.jurisdiction}, ${replacement.kind},
            ${replacement.instrument_type ?? null}, ${replacement.implementation_stage},
            ${replacement.beneficiary_targeting}, ${replacement.durability ?? null},
            ${replacement.attribution}, ${replacement.announcement_time ?? null},
            ${replacement.valid_from ?? null}, ${replacement.valid_to ?? null},
            ${replacement.program_family_id ?? null},
            ${replacement.underlying_instrument_id ?? null}, ${newStatus}, ${structuredBody}
          )
          RETURNING *`;
        const superseded = one(
          await tx<ActionRow[]>`SELECT * FROM actions WHERE id = ${oldActionId}`,
          "action",
        );
        return { superseded, replacement: one(insertedRows, "action") };
      });
    },

    async addRelationship(input: ActionRelationshipInput): Promise<void> {
      await sql`
        INSERT INTO action_relationships (
          source_action_id, relationship_type, target_action_id,
          supporting_claim_ids, status
        ) VALUES (
          ${input.source_action_id}, ${input.relationship_type}, ${input.target_action_id},
          ${json(sql, input.supporting_claim_ids ?? [])}, ${input.status ?? "candidate"}
        )
        ON CONFLICT (source_action_id, relationship_type, target_action_id) DO NOTHING`;
    },
  };
}

export type ActionsRepository = ReturnType<typeof actionsRepository>;
