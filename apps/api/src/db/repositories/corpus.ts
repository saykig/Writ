// Append-only, content-addressed corpus artifact storage.
import { createHash } from "node:crypto";
import type { DbClient } from "../client.js";
import { json, withTransaction } from "./shared.js";

export const CORPUS_OBJECT_KINDS = [
  "source_registry",
  "schema",
  "source_manifest",
  "ingestion_report",
  "raw_source",
  "normalized_record",
  "benchmark",
] as const;

export type CorpusObjectKind = (typeof CORPUS_OBJECT_KINDS)[number];

export interface CorpusArtifactInput {
  logicalId: string;
  sourceId: string;
  objectKind: CorpusObjectKind;
  content: Uint8Array;
  mediaType: string;
  schemaVersion?: string;
  summitSlug?: string;
  provenance: Record<string, unknown>;
}

export interface PreparedCorpusArtifact extends CorpusArtifactInput {
  artifactSha256: string;
  byteSize: number;
  objectId: string;
}

export interface PublishedCorpusArtifact extends PreparedCorpusArtifact {
  created: boolean;
  supersedesObjectId: string | null;
}

function sha256(data: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(data).digest("hex")}`;
}

export function prepareCorpusArtifact(input: CorpusArtifactInput): PreparedCorpusArtifact {
  if (input.content.byteLength === 0) {
    throw new Error(`corpus artifact ${input.logicalId} is empty`);
  }
  const artifactSha256 = sha256(input.content);
  const objectId = `corpus:${sha256(`${input.logicalId}\0${artifactSha256}`).slice(7)}`;
  return {
    ...input,
    content: new Uint8Array(input.content),
    artifactSha256,
    byteSize: input.content.byteLength,
    objectId,
  };
}

export interface CorpusCurrentObject {
  id: string;
  logical_id: string;
  source_id: string;
  object_kind: CorpusObjectKind;
  schema_version: string | null;
  summit_slug: string | null;
  artifact_sha256: string;
  byte_size: string;
  media_type: string;
  provenance: Record<string, unknown>;
  supersedes_object_id: string | null;
  published_at: Date;
}

export interface StoredCorpusObject extends CorpusCurrentObject {
  content: Uint8Array;
}

export function corpusRepository(sql: DbClient) {
  return {
    prepare: prepareCorpusArtifact,

    async publish(input: CorpusArtifactInput): Promise<PublishedCorpusArtifact> {
      const artifact = prepareCorpusArtifact(input);
      return withTransaction(sql, async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtext(${artifact.logicalId}))`;
        const currentRows = await tx<CorpusCurrentObject[]>`
          SELECT * FROM corpus_current_objects
          WHERE logical_id = ${artifact.logicalId}`;
        if (currentRows.length > 1) {
          throw new Error(
            `logical corpus object has multiple current versions: ${artifact.logicalId}`,
          );
        }
        const current = currentRows[0] ?? null;
        if (current?.artifact_sha256 === artifact.artifactSha256) {
          return {
            ...artifact,
            created: false,
            supersedesObjectId: current.supersedes_object_id,
          };
        }

        await tx`
          INSERT INTO corpus_blobs (sha256, content, byte_size, media_type)
          VALUES (
            ${artifact.artifactSha256},
            ${artifact.content},
            ${artifact.byteSize},
            ${artifact.mediaType}
          )
          ON CONFLICT (sha256) DO NOTHING`;

        await tx`
          INSERT INTO corpus_objects (
            id, logical_id, source_id, object_kind, schema_version, summit_slug,
            artifact_sha256, provenance, supersedes_object_id
          ) VALUES (
            ${artifact.objectId},
            ${artifact.logicalId},
            ${artifact.sourceId},
            ${artifact.objectKind},
            ${artifact.schemaVersion ?? null},
            ${artifact.summitSlug ?? null},
            ${artifact.artifactSha256},
            ${json(tx, artifact.provenance)},
            ${current?.id ?? null}
          )`;

        return {
          ...artifact,
          created: true,
          supersedesObjectId: current?.id ?? null,
        };
      });
    },

    async current(sourceId?: string): Promise<CorpusCurrentObject[]> {
      if (sourceId) {
        return sql<CorpusCurrentObject[]>`
          SELECT * FROM corpus_current_objects
          WHERE source_id = ${sourceId}
          ORDER BY logical_id`;
      }
      return sql<CorpusCurrentObject[]>`
        SELECT * FROM corpus_current_objects ORDER BY source_id, logical_id`;
    },

    async readCurrent(logicalId: string): Promise<StoredCorpusObject | null> {
      const rows = await sql<StoredCorpusObject[]>`
        SELECT current_object.*, blob.content
        FROM corpus_current_objects AS current_object
        JOIN corpus_blobs AS blob
          ON blob.sha256 = current_object.artifact_sha256
        WHERE current_object.logical_id = ${logicalId}`;
      if (rows.length > 1) {
        throw new Error(`logical corpus object has multiple current versions: ${logicalId}`);
      }
      return rows[0] ?? null;
    },
  };
}

export type CorpusRepository = ReturnType<typeof corpusRepository>;
