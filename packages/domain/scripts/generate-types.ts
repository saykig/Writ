/**
 * Regenerates TypeScript interfaces from the vendored JSON Schemas into
 * `src/generated/`. Run via `bun run generate` (writes to src/generated) or with
 * an explicit output directory: `bun scripts/generate-types.ts <outDir>`.
 *
 * The same module is used by `test/generated-types.test.ts`, which regenerates
 * into a temp directory and compares, so the generator must be deterministic.
 *
 * `json-schema-to-typescript` is a repo-root devDependency (binary `json2ts`);
 * we use its Node API for name/formatting control.
 */
import { compile } from "json-schema-to-typescript";
import prettier from "prettier";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(HERE, "..", "schemas");

/** File stem -> exported interface name for the root type of each schema. */
export const GENERATED_TYPES: ReadonlyArray<{ file: string; name: string }> = [
  { file: "evidence", name: "Evidence" },
  { file: "source-registry", name: "SourceRegistry" },
];

const BANNER =
  "/* eslint-disable */\n" +
  "/**\n" +
  " * This file was automatically generated from the vendored JSON Schema.\n" +
  " * Do not edit by hand. Regenerate with `bun run generate` in packages/domain.\n" +
  " */\n";

/** Compile a single schema to a formatted TypeScript source string. */
export async function generateOne(file: string, name: string): Promise<string> {
  const raw = JSON.parse(
    await readFile(join(SCHEMAS_DIR, `${file}.schema.json`), "utf8"),
  ) as Record<string, unknown>;
  // Override `title`/`$id` so the root interface takes our clean PascalCase name
  // instead of a title- or URL-derived identifier.
  const copy = structuredClone(raw);
  copy.title = name;
  delete copy.$id;
  const compiled = await compile(copy as Parameters<typeof compile>[0], name, {
    bannerComment: "",
    additionalProperties: false,
    format: false,
    declareExternallyReferenced: true,
  });
  const withBanner = `${BANNER}\n${compiled}`;
  return prettier.format(withBanner, { parser: "typescript" });
}

/** Regenerate every type file into `outDir`. */
export async function generateAll(outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  for (const { file, name } of GENERATED_TYPES) {
    const source = await generateOne(file, name);
    await writeFile(join(outDir, `${file}.ts`), source, "utf8");
  }
}

if (import.meta.main) {
  const outDir = process.argv[2] ?? join(HERE, "..", "src", "generated");
  await generateAll(outDir);
  console.log(`Generated ${GENERATED_TYPES.length} type files into ${outDir}`);
}
