// Frozen evidence snapshots. A snapshot and its membership are immutable once
// written (enforced by triggers); a published score must trace to one.
import type { DbClient } from "../client.js";
import type { EvidenceSnapshotInput, EvidenceSnapshotRow } from "../types.js";
import { maybe, one, withTransaction } from "./shared.js";

export function snapshotsRepository(sql: DbClient) {
  return {
    /** Freeze a snapshot together with its document-version membership. */
    async freeze(input: EvidenceSnapshotInput): Promise<EvidenceSnapshotRow> {
      const members = input.document_version_ids ?? [];
      return withTransaction(sql, async (tx) => {
        const rows = await tx<EvidenceSnapshotRow[]>`
          INSERT INTO evidence_snapshots (
            id, frozen_at, cutoff, content_hash, description, created_by
          ) VALUES (
            ${input.id}, ${input.frozen_at}, ${input.cutoff}, ${input.content_hash},
            ${input.description ?? null}, ${input.created_by}
          )
          RETURNING *`;
        for (const versionId of members) {
          await tx`
            INSERT INTO snapshot_document_versions (snapshot_id, document_version_id)
            VALUES (${input.id}, ${versionId})`;
        }
        return one(rows, "evidence_snapshot");
      });
    },

    async get(id: string): Promise<EvidenceSnapshotRow | null> {
      return maybe(
        await sql<EvidenceSnapshotRow[]>`SELECT * FROM evidence_snapshots WHERE id = ${id}`,
      );
    },

    async listMembers(snapshotId: string): Promise<string[]> {
      const rows = await sql<{ document_version_id: string }[]>`
        SELECT document_version_id FROM snapshot_document_versions
        WHERE snapshot_id = ${snapshotId}
        ORDER BY document_version_id`;
      return rows.map((r) => r.document_version_id);
    },
  };
}

export type SnapshotsRepository = ReturnType<typeof snapshotsRepository>;
