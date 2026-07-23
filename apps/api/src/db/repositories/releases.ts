// Release manifests. A published release row is immutable (enforced by trigger):
// the only permitted transition is draft/candidate -> published.
import type { DbClient } from "../client.js";
import type { ReleaseInput, ReleaseRow } from "../types.js";
import { json, maybe, one } from "./shared.js";

export function releasesRepository(sql: DbClient) {
  return {
    async insert(input: ReleaseInput): Promise<ReleaseRow> {
      const rows = await sql<ReleaseRow[]>`
        INSERT INTO releases (
          id, name, version, methodology_bundle_ids, evidence_snapshot_ids,
          receipt_ids, manifest, canonical_hash, signature, status, created_by, published_at
        ) VALUES (
          ${input.id}, ${input.name}, ${input.version},
          ${json(sql, input.methodology_bundle_ids)}, ${json(sql, input.evidence_snapshot_ids)},
          ${json(sql, input.receipt_ids)}, ${json(sql, input.manifest)}, ${input.canonical_hash},
          ${input.signature ? json(sql, input.signature) : null}, ${input.status ?? "draft"},
          ${input.created_by}, ${input.published_at ?? null}
        )
        RETURNING *`;
      return one(rows, "release");
    },

    async get(id: string): Promise<ReleaseRow | null> {
      return maybe(await sql<ReleaseRow[]>`SELECT * FROM releases WHERE id = ${id}`);
    },

    /** Publish a draft/candidate release. Fails if already published (immutable). */
    async publish(id: string, signature?: unknown): Promise<ReleaseRow> {
      const rows = await sql<ReleaseRow[]>`
        UPDATE releases SET
          status = 'published',
          published_at = COALESCE(published_at, now()),
          signature = COALESCE(${signature ? json(sql, signature) : null}, signature)
        WHERE id = ${id}
        RETURNING *`;
      return one(rows, "release");
    },
  };
}

export type ReleasesRepository = ReturnType<typeof releasesRepository>;
