// Claims: bitemporal version rows, evidence links, and supersession.
//
// A claim's valid-time is (valid_from, valid_to); its system-time is
// (system_from, system_to). A row is the CURRENT record while system_to IS NULL.
// Accepted claims are never edited: `supersede` closes the old row's system-time
// interval and inserts a new row sharing the same logical_id.
import type { DbClient } from "../client.js";
import type { ClaimInput, ClaimRow, ClaimStatus, EvidenceLinkInput } from "../types.js";
import { json, maybe, one, withTransaction } from "./shared.js";

export interface SupersedeResult {
  superseded: ClaimRow;
  replacement: ClaimRow;
}

export function claimsRepository(sql: DbClient) {
  async function insert(input: ClaimInput): Promise<ClaimRow> {
    const rows = await sql<ClaimRow[]>`
      INSERT INTO claims (
        id, logical_id, claim_type, subject_ref, predicate, object_value,
        qualifiers, truth_value, status, valid_from, valid_to, recorded_at,
        origin, created_by, supersedes_claim_id
      ) VALUES (
        ${input.id}, ${input.logical_id ?? null}, ${input.claim_type},
        ${input.subject_ref}, ${input.predicate}, ${json(sql, input.object_value)},
        ${json(sql, input.qualifiers ?? {})}, ${input.truth_value}, ${input.status},
        ${input.valid_from ?? null}, ${input.valid_to ?? null}, ${input.recorded_at},
        ${input.origin}, ${input.created_by ?? null}, ${input.supersedes_claim_id ?? null}
      )
      RETURNING *`;
    return one(rows, "claim");
  }

  return {
    insert,

    async get(id: string): Promise<ClaimRow | null> {
      return maybe(await sql<ClaimRow[]>`SELECT * FROM claims WHERE id = ${id}`);
    },

    /** The current (open) system-time row for a logical claim, if any. */
    async currentByLogicalId(logicalId: string): Promise<ClaimRow | null> {
      return maybe(
        await sql<ClaimRow[]>`
          SELECT * FROM claims WHERE logical_id = ${logicalId} AND system_to IS NULL`,
      );
    },

    async listBySubject(subjectRef: string, predicate?: string): Promise<ClaimRow[]> {
      if (predicate === undefined) {
        return sql<ClaimRow[]>`
          SELECT * FROM claims WHERE subject_ref = ${subjectRef} ORDER BY recorded_at DESC`;
      }
      return sql<ClaimRow[]>`
        SELECT * FROM claims
        WHERE subject_ref = ${subjectRef} AND predicate = ${predicate}
        ORDER BY recorded_at DESC`;
    },

    /** Transition a candidate/contested claim to accepted. */
    async accept(id: string): Promise<ClaimRow> {
      const rows = await sql<ClaimRow[]>`
        UPDATE claims SET status = 'accepted'
        WHERE id = ${id} AND status <> 'accepted'
        RETURNING *`;
      return one(rows, "claim");
    },

    /** Reject a candidate/contested claim (no acceptance, never applied to accepted rows). */
    async reject(id: string): Promise<ClaimRow> {
      const rows = await sql<ClaimRow[]>`
        UPDATE claims SET status = 'rejected'
        WHERE id = ${id} AND status IN ('candidate', 'contested')
        RETURNING *`;
      return one(rows, "claim");
    },

    /** Mark a candidate claim contested (a dispute short of rejection). */
    async contest(id: string): Promise<ClaimRow> {
      const rows = await sql<ClaimRow[]>`
        UPDATE claims SET status = 'contested'
        WHERE id = ${id} AND status = 'candidate'
        RETURNING *`;
      return one(rows, "claim");
    },

    /**
     * Supersede a claim: close the old row's system-time interval (status ->
     * superseded) and insert a replacement sharing the logical_id. Runs in one
     * transaction so the partial-unique "one open row per logical_id" invariant
     * never observes two open rows.
     */
    async supersede(
      oldClaimId: string,
      replacement: ClaimInput,
      options: { status?: ClaimStatus } = {},
    ): Promise<SupersedeResult> {
      const objectValue = json(sql, replacement.object_value);
      const qualifiers = json(sql, replacement.qualifiers ?? {});
      const newStatus = options.status ?? "accepted";

      return withTransaction(sql, async (tx) => {
        const old = one(
          await tx<ClaimRow[]>`SELECT * FROM claims WHERE id = ${oldClaimId} FOR UPDATE`,
          "claim",
        );
        // Close the old row first so the new open row does not collide.
        await tx`
          UPDATE claims SET status = 'superseded', system_to = now()
          WHERE id = ${oldClaimId}`;
        const insertedRows = await tx<ClaimRow[]>`
          INSERT INTO claims (
            id, logical_id, claim_type, subject_ref, predicate, object_value,
            qualifiers, truth_value, status, valid_from, valid_to, recorded_at,
            origin, created_by, supersedes_claim_id
          ) VALUES (
            ${replacement.id}, ${replacement.logical_id ?? old.logical_id},
            ${replacement.claim_type}, ${replacement.subject_ref}, ${replacement.predicate},
            ${objectValue}, ${qualifiers}, ${replacement.truth_value}, ${newStatus},
            ${replacement.valid_from ?? null}, ${replacement.valid_to ?? null},
            ${replacement.recorded_at}, ${replacement.origin},
            ${replacement.created_by ?? null}, ${oldClaimId}
          )
          RETURNING *`;
        const superseded = one(
          await tx<ClaimRow[]>`SELECT * FROM claims WHERE id = ${oldClaimId}`,
          "claim",
        );
        return { superseded, replacement: one(insertedRows, "claim") };
      });
    },

    async addEvidenceLink(link: EvidenceLinkInput): Promise<void> {
      await sql`
        INSERT INTO claim_evidence_links (claim_id, passage_id, stance, support_type)
        VALUES (${link.claim_id}, ${link.passage_id}, ${link.stance}, ${link.support_type})
        ON CONFLICT (claim_id, passage_id, stance) DO UPDATE
          SET support_type = EXCLUDED.support_type`;
    },

    async linkToAction(actionId: string, claimId: string): Promise<void> {
      await sql`
        INSERT INTO action_claims (action_id, claim_id)
        VALUES (${actionId}, ${claimId})
        ON CONFLICT (action_id, claim_id) DO NOTHING`;
    },
  };
}

export type ClaimsRepository = ReturnType<typeof claimsRepository>;
