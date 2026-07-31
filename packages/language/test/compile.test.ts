import { test, expect, describe } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  compileSource,
  isClean,
  formatText,
  extractLiterate,
  checkModel,
  parseDocument,
} from "../src/index.js";
import { isValid } from "@writ/domain";
import { sha256Canonical } from "@writ/provenance";
import golden from "../../../internal/verification/fixtures/compatibility/g7-ai-sme/schemas/2025-ai-sme-literal.ir.json" with { type: "json" };

const FIXTURE_DIRS = [
  fileURLToPath(
    new URL(
      "../../../internal/verification/fixtures/compatibility/g7-ai-sme/language/",
      import.meta.url,
    ),
  ),
  fileURLToPath(
    new URL("../../../internal/verification/fixtures/language/g7-methodologies/", import.meta.url),
  ),
];
const examples = FIXTURE_DIRS.flatMap((directory) =>
  readdirSync(directory)
    .filter((file) => file.endsWith(".writ"))
    .map((file) => ({ file, path: `${directory}/${file}` })),
).sort((left, right) => left.file.localeCompare(right.file));

function fixturePath(file: string): string {
  const fixture = examples.find((candidate) => candidate.file === file);
  if (!fixture) throw new Error(`missing language fixture: ${file}`);
  return fixture.path;
}

function read(file: string): string {
  return readFileSync(fixturePath(file), "utf8");
}

describe("LANG-003 compile fixtures to schema-valid IR", () => {
  test("all checked-in .writ fixtures exist", () => {
    expect(examples.length).toBeGreaterThanOrEqual(6);
  });

  for (const { file, path } of examples) {
    test(`${file} compiles clean and validates against canonical-ir`, () => {
      const result = compileSource(read(file), { fileName: path });
      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect({ file, errors }).toEqual({ file, errors: [] });
      expect(isClean(result)).toBe(true);
      expect(result.ir).toBeDefined();
      expect(isValid("canonical-ir", result.ir)).toBe(true);
    });
  }
});

describe("LANG-003 golden IR fidelity", () => {
  test("2025-ai-sme-literal compiles to the golden IR (canonical hash)", () => {
    const result = compileSource(read("2025-ai-sme-literal.writ"), {
      fileName: fixturePath("2025-ai-sme-literal.writ"),
    });
    expect(result.ir).toBeDefined();
    expect(sha256Canonical(result.ir)).toBe(sha256Canonical(golden));
  });

  test("compilation is deterministic (same source => same canonical IR)", () => {
    const src = read("2025-ai-sme-resolved.writ");
    const a = compileSource(src, { fileName: "a" });
    const b = compileSource(src, { fileName: "a" });
    expect(sha256Canonical(a.ir)).toBe(sha256Canonical(b.ir));
  });
});

describe("LANG-001 formatter is idempotent", () => {
  for (const { file } of examples) {
    test(`${file} format(format(x)) === format(x)`, () => {
      const once = formatText(read(file));
      const twice = formatText(once);
      expect(twice).toBe(once);
    });
  }
});

describe("LANG-001 literate extraction", () => {
  test("fenced writ blocks in Markdown extract and compile", () => {
    const literal = read("2025-ai-sme-literal.writ");
    const md = `# AI for SMEs\n\nSome prose.\n\n\`\`\`writ\n${literal}\n\`\`\`\n\nMore prose.\n`;
    const extracted = extractLiterate(md);
    expect(extracted.trim().length).toBeGreaterThan(0);
    // extracted is already plain Writ: compile it directly (a .writ.md
    // name would re-run literate extraction on already-extracted source).
    const result = compileSource(extracted, { fileName: "literate.writ" });
    expect(isClean(result)).toBe(true);
  });
});

describe("LANG-002 diagnostics on broken source", () => {
  test("garbage source is not clean and yields error diagnostics", () => {
    const result = compileSource("@@@ this is not writ @@@\n", { fileName: "broken" });
    expect(isClean(result)).toBe(false);
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  test("checkModel runs over a parsed valid model without throwing", () => {
    const parsed = parseDocument(read("2025-ai-sme-resolved.writ"), {});
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const checked = checkModel(parsed.model);
      expect(Array.isArray(checked.diagnostics)).toBe(true);
    }
  });
});
