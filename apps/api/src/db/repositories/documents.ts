// Documents, immutable document versions, and anchored passages.
import type { DbClient } from "../client.js";
import type {
  DocumentInput,
  DocumentRow,
  DocumentVersionInput,
  DocumentVersionRow,
  PassageInput,
  PassageRow,
} from "../types.js";
import { json, maybe, one } from "./shared.js";

export function documentsRepository(sql: DbClient) {
  return {
    async insertDocument(input: DocumentInput): Promise<DocumentRow> {
      const rows = await sql<DocumentRow[]>`
        INSERT INTO documents (
          id, source_registry_id, canonical_uri, publisher,
          publisher_institution_id, jurisdiction, document_type
        ) VALUES (
          ${input.id}, ${input.source_registry_id ?? null}, ${input.canonical_uri},
          ${input.publisher ?? null}, ${input.publisher_institution_id ?? null},
          ${input.jurisdiction ?? null}, ${input.document_type ?? null}
        )
        RETURNING *`;
      return one(rows, "document");
    },

    async getDocument(id: string): Promise<DocumentRow | null> {
      return maybe(await sql<DocumentRow[]>`SELECT * FROM documents WHERE id = ${id}`);
    },

    async insertVersion(input: DocumentVersionInput): Promise<DocumentVersionRow> {
      const rows = await sql<DocumentVersionRow[]>`
        INSERT INTO document_versions (
          id, document_id, retrieved_at, issued_at, media_type, byte_size,
          sha256, storage_uri, warc_record_id, http_status, response_headers,
          extraction_status
        ) VALUES (
          ${input.id}, ${input.document_id}, ${input.retrieved_at},
          ${input.issued_at ?? null}, ${input.media_type},
          ${input.byte_size !== undefined && input.byte_size !== null
            ? String(input.byte_size)
            : null},
          ${input.sha256}, ${input.storage_uri}, ${input.warc_record_id ?? null},
          ${input.http_status ?? null}, ${json(sql, input.response_headers ?? {})},
          ${input.extraction_status ?? "pending"}
        )
        RETURNING *`;
      return one(rows, "document_version");
    },

    async getVersion(id: string): Promise<DocumentVersionRow | null> {
      return maybe(
        await sql<DocumentVersionRow[]>`SELECT * FROM document_versions WHERE id = ${id}`,
      );
    },

    async listVersions(documentId: string): Promise<DocumentVersionRow[]> {
      return sql<DocumentVersionRow[]>`
        SELECT * FROM document_versions
        WHERE document_id = ${documentId}
        ORDER BY retrieved_at DESC`;
    },

    /** Extraction status may progress (pending -> extracted); versions are otherwise append-only. */
    async setExtractionStatus(id: string, status: string): Promise<void> {
      await sql`UPDATE document_versions SET extraction_status = ${status} WHERE id = ${id}`;
    },

    async insertPassage(input: PassageInput): Promise<PassageRow> {
      const rows = await sql<PassageRow[]>`
        INSERT INTO passages (
          id, document_version_id, anchor_type, page_number, anchor,
          quote, normalized_quote, anchor_hash, language
        ) VALUES (
          ${input.id}, ${input.document_version_id}, ${input.anchor_type},
          ${input.page_number ?? null}, ${json(sql, input.anchor)}, ${input.quote},
          ${input.normalized_quote}, ${input.anchor_hash}, ${input.language ?? null}
        )
        RETURNING *`;
      return one(rows, "passage");
    },

    async getPassage(id: string): Promise<PassageRow | null> {
      return maybe(await sql<PassageRow[]>`SELECT * FROM passages WHERE id = ${id}`);
    },

    async listPassages(documentVersionId: string): Promise<PassageRow[]> {
      return sql<PassageRow[]>`
        SELECT * FROM passages WHERE document_version_id = ${documentVersionId} ORDER BY id`;
    },
  };
}

export type DocumentsRepository = ReturnType<typeof documentsRepository>;
