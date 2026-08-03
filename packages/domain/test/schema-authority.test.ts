import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCHEMAS_ROOT = join(REPO_ROOT, "schemas");

function schemaFiles(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? schemaFiles(path) : [path];
    })
    .filter((path) => path.endsWith(".schema.json"))
    .sort();
}

function walk(value: unknown, visit: (record: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  visit(record);
  for (const child of Object.values(record)) walk(child, visit);
}

describe("schema authority", () => {
  const files = schemaFiles(SCHEMAS_ROOT);

  test("the former mixed contract root is absent", () => {
    expect(existsSync(join(REPO_ROOT, "specs"))).toBe(false);
  });

  test("every authoritative schema has a path-derived id and layer-safe references", () => {
    expect(files).toHaveLength(24);
    for (const file of files) {
      const schema = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      const path = relative(REPO_ROOT, file).split(sep).join("/");
      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(schema.$id).toBe(`https://writ.example/${path}`);
      walk(schema, (record) => {
        if (typeof record.$ref !== "string") return;
        const local = record.$ref.startsWith("#/");
        const coreDependency =
          path.startsWith("schemas/extensions/") &&
          record.$ref.startsWith("https://writ.example/schemas/core/record.schema.json#/");
        expect(local || coreDependency).toBe(true);
      });
    }
  });

  test("core required fields never impose commitment, obligation, or score data", () => {
    const forbidden = /commitment|obligation|score/i;
    for (const file of files.filter((path) => path.startsWith(join(SCHEMAS_ROOT, "core")))) {
      const schema: unknown = JSON.parse(readFileSync(file, "utf8"));
      walk(schema, (record) => {
        if (!Array.isArray(record.required)) return;
        for (const field of record.required) {
          expect(String(field)).not.toMatch(forbidden);
        }
      });
    }
  });

  test("record extensions inherit the complete base and close unevaluated fields", () => {
    for (const name of ["legal-policy-record", "institutional-record"]) {
      const file = join(SCHEMAS_ROOT, "extensions", `${name}.schema.json`);
      const schema = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      const allOf = schema.allOf as Array<Record<string, unknown>>;
      expect(allOf[0]?.$ref).toBe(
        "https://writ.example/schemas/core/record.schema.json#/$defs/recordBase",
      );
      expect(schema.unevaluatedProperties).toBe(false);
      expect(schema.properties).toBeUndefined();
      expect(schema.required).toBeUndefined();
    }
  });
});
