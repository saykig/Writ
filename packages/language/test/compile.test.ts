import { test, expect, describe } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import {
  compileSource,
  isClean,
  formatText,
  extractLiterate,
  checkModel,
  parseDocument,
} from "../src/index.js";
import { isValid } from "@covenant/domain";
import { sha256Canonical } from "@covenant/provenance";
import golden from "../../../examples/2025-ai-sme-literal.ir.json" with { type: "json" };

const EXAMPLE_DIR = "examples";
const examples = readdirSync(EXAMPLE_DIR)
  .filter((f) => f.endsWith(".covenant"))
  .sort();

function read(file: string): string {
  return readFileSync(`${EXAMPLE_DIR}/${file}`, "utf8");
}

describe("LANG-003 compile examples to schema-valid IR", () => {
  test("all checked-in .covenant examples exist", () => {
    expect(examples.length).toBeGreaterThanOrEqual(6);
  });

  for (const file of examples) {
    test(`${file} compiles clean and validates against canonical-ir`, () => {
      const result = compileSource(read(file), { fileName: `${EXAMPLE_DIR}/${file}` });
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
    const result = compileSource(read("2025-ai-sme-literal.covenant"), {
      fileName: `${EXAMPLE_DIR}/2025-ai-sme-literal.covenant`,
    });
    expect(result.ir).toBeDefined();
    expect(sha256Canonical(result.ir)).toBe(sha256Canonical(golden));
  });

  test("compilation is deterministic (same source => same canonical IR)", () => {
    const src = read("2025-ai-sme-resolved.covenant");
    const a = compileSource(src, { fileName: "a" });
    const b = compileSource(src, { fileName: "a" });
    expect(sha256Canonical(a.ir)).toBe(sha256Canonical(b.ir));
  });
});

describe("LANG-001 formatter is idempotent", () => {
  for (const file of examples) {
    test(`${file} format(format(x)) === format(x)`, () => {
      const once = formatText(read(file));
      const twice = formatText(once);
      expect(twice).toBe(once);
    });
  }
});

describe("LANG-001 literate extraction", () => {
  test("fenced covenant blocks in Markdown extract and compile", () => {
    const literal = read("2025-ai-sme-literal.covenant");
    const md = `# AI for SMEs\n\nSome prose.\n\n\`\`\`covenant\n${literal}\n\`\`\`\n\nMore prose.\n`;
    const extracted = extractLiterate(md);
    expect(extracted.trim().length).toBeGreaterThan(0);
    // extracted is already plain Covenant: compile it directly (a .covenant.md
    // name would re-run literate extraction on already-extracted source).
    const result = compileSource(extracted, { fileName: "literate.covenant" });
    expect(isClean(result)).toBe(true);
  });
});

describe("LANG-002 diagnostics on broken source", () => {
  test("garbage source is not clean and yields error diagnostics", () => {
    const result = compileSource("@@@ this is not covenant @@@\n", { fileName: "broken" });
    expect(isClean(result)).toBe(false);
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  test("checkModel runs over a parsed valid model without throwing", () => {
    const parsed = parseDocument(read("2025-ai-sme-resolved.covenant"), {});
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const checked = checkModel(parsed.model);
      expect(Array.isArray(checked.diagnostics)).toBe(true);
    }
  });
});
