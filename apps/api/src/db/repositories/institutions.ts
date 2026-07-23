// Institutions and their aliases.
import type { DbClient } from "../client.js";
import type { InstitutionInput, InstitutionRow } from "../types.js";
import { json, maybe, one } from "./shared.js";

export interface AliasInput {
  institution_id: string;
  alias: string;
  alias_type?: string;
  language?: string | null;
}

export function institutionsRepository(sql: DbClient) {
  return {
    async insert(input: InstitutionInput): Promise<InstitutionRow> {
      const rows = await sql<InstitutionRow[]>`
        INSERT INTO institutions (
          id, legal_name, short_name, jurisdiction, institution_type,
          canonical_uri, official_identifiers
        ) VALUES (
          ${input.id}, ${input.legal_name}, ${input.short_name ?? null},
          ${input.jurisdiction ?? null}, ${input.institution_type ?? null},
          ${input.canonical_uri ?? null}, ${json(sql, input.official_identifiers ?? {})}
        )
        RETURNING *`;
      return one(rows, "institution");
    },

    async get(id: string): Promise<InstitutionRow | null> {
      return maybe(await sql<InstitutionRow[]>`SELECT * FROM institutions WHERE id = ${id}`);
    },

    async list(): Promise<InstitutionRow[]> {
      return sql<InstitutionRow[]>`SELECT * FROM institutions ORDER BY legal_name`;
    },

    async addAlias(input: AliasInput): Promise<void> {
      await sql`
        INSERT INTO institution_aliases (institution_id, alias, alias_type, language)
        VALUES (${input.institution_id}, ${input.alias}, ${input.alias_type ?? "name"},
                ${input.language ?? null})
        ON CONFLICT (institution_id, alias, alias_type) DO NOTHING`;
    },
  };
}

export type InstitutionsRepository = ReturnType<typeof institutionsRepository>;
