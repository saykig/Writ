import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import _Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import _addFormats from "ajv-formats";

import { issue, type VerificationIssue } from "./types.js";

type DefaultExport<T> = T extends { default: infer D } ? D : T;
const Ajv2020 = ((_Ajv2020 as { default?: unknown }).default ?? _Ajv2020) as DefaultExport<
  typeof _Ajv2020
>;
const addFormats = ((_addFormats as { default?: unknown }).default ?? _addFormats) as DefaultExport<
  typeof _addFormats
>;

export type JsonSchema = Record<string, unknown>;

export interface AuthoritativeSchema {
  id: string;
  file: string;
  document: JsonSchema;
}

export interface AuthorityIndex {
  schemas: ReadonlyMap<string, AuthoritativeSchema>;
  issues: VerificationIssue[];
  validate(schemaId: string, value: unknown): { valid: boolean; errors: ErrorObject[] };
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((name) => {
      const child = join(directory, name);
      return statSync(child).isDirectory() ? filesUnder(child) : [child];
    })
    .sort();
}

/** Build the normative schema index exclusively from the repository `schemas/` tree. */
export function loadAuthorityIndex(root: string): AuthorityIndex {
  const schemaRoot = join(root, "schemas");
  const schemas = new Map<string, AuthoritativeSchema>();
  const issues: VerificationIssue[] = [];
  for (const file of filesUnder(schemaRoot).filter((path) => path.endsWith(".schema.json"))) {
    let document: JsonSchema;
    try {
      document = JSON.parse(readFileSync(file, "utf8")) as JsonSchema;
    } catch (error) {
      issues.push(
        issue(
          "integrity",
          "INTEGRITY_CONTRACT_INVALID",
          `Invalid authoritative schema JSON: ${String(error)}`,
          {
            file: relative(root, file),
          },
        ),
      );
      continue;
    }
    const id = typeof document.$id === "string" ? document.$id : "";
    if (id.length === 0) {
      issues.push(
        issue("integrity", "INTEGRITY_CONTRACT_INVALID", "Authoritative schema has no $id.", {
          file: relative(root, file),
        }),
      );
      continue;
    }
    const existing = schemas.get(id);
    if (existing) {
      issues.push(
        issue(
          "integrity",
          "VERIFIER_AUTHORITY_CONFLICT",
          `Authoritative schema ID ${id} is declared more than once.`,
          {
            file: `${existing.file}, ${relative(root, file)}`,
          },
        ),
      );
      continue;
    }
    schemas.set(id, { id, file: relative(root, file), document });
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const schema of schemas.values()) {
    try {
      ajv.addSchema(schema.document, schema.id);
    } catch (error) {
      issues.push(
        issue(
          "integrity",
          "VERIFIER_AUTHORITY_CONFLICT",
          `Cannot register authoritative schema ${schema.id}: ${String(error)}`,
          {
            file: schema.file,
          },
        ),
      );
    }
  }

  const validators = new Map<string, ValidateFunction>();
  return {
    schemas,
    issues,
    validate(schemaId, value) {
      let validator = validators.get(schemaId);
      if (!validator) {
        try {
          const compiled = ajv.getSchema(schemaId) ?? ajv.compile({ $ref: schemaId });
          validators.set(schemaId, compiled);
          validator = compiled;
        } catch {
          return { valid: false, errors: [] };
        }
      }
      const resolved = validator!;
      const valid = resolved(value);
      return { valid: Boolean(valid), errors: [...(resolved.errors ?? [])] };
    },
  };
}

export function renderSchemaErrors(errors: readonly ErrorObject[]): string {
  return errors
    .slice(0, 8)
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
}
