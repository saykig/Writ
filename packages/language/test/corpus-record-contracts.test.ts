/**
 * The manifest-to-record gate.
 *
 * A corpus manifest declares one `record_contract`. This loads every catalogued
 * manifest and validates every record file it lists against exactly that contract.
 * A manifest cannot pass because its own structure is valid while the files it
 * points at fail the contract it names.
 *
 * `.writ` files are compiled first and their lowered records are validated, so the
 * native-grammar corpora are held to the same rule as the YAML ones.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isKnownContract, validate, validateContract } from "@writ/domain";
import { compileSource, parseDocument } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

interface CatalogEntry {
  corpus_id: string;
  family: "legal_policy" | "institutional";
  jurisdiction: string;
  status: string;
  path: string;
  manifest: string;
}

interface Manifest {
  corpus_id: string;
  family: string;
  record_contract: { kind: "native" | "compatibility"; id: string; version: string };
  locations: Record<string, string[]>;
  migration_aliases: string[];
}

interface Catalog {
  native_corpora: CatalogEntry[];
  retired_corpus_migrations: {
    retired_corpus_id: string;
    old_path: string;
    replacement_corpus_ids: string[];
  }[];
}

const yaml = <T>(relativePath: string): T =>
  Bun.YAML.parse(readFileSync(join(ROOT, relativePath), "utf8")) as T;

const catalog = yaml<Catalog>("corpora/catalog.yaml");

/** Every file a `locations` entry resolves to; a directory contributes its `.writ` files. */
function expand(corpusPath: string, location: string): string[] {
  const absolute = resolve(ROOT, corpusPath, location);
  if (!statSync(absolute).isDirectory()) return [absolute];
  const walk = (directory: string): string[] =>
    readdirSync(directory).flatMap((name) => {
      const child = join(directory, name);
      return statSync(child).isDirectory() ? walk(child) : child.endsWith(".writ") ? [child] : [];
    });
  return walk(absolute).sort();
}

/** True when `absolute` lives inside the corpus that listed it. */
function ownedBy(corpusPath: string, absolute: string): boolean {
  const inside = relative(resolve(ROOT, corpusPath), absolute);
  return !inside.startsWith("..") && !isAbsolute(inside);
}

const corpora = catalog.native_corpora.map((entry) => ({
  entry,
  manifest: yaml<Manifest>(entry.manifest),
}));

describe("every catalogued manifest declares the contract its record files satisfy", () => {
  test("the catalog is not empty and matches the manifests it points at", () => {
    expect(corpora).toHaveLength(16);
    for (const { entry, manifest } of corpora) {
      expect(manifest.corpus_id).toBe(entry.corpus_id);
      expect(manifest.family).toBe(entry.family);
    }
  });

  test("the gate actually validates every corpus and both file kinds", () => {
    // Without this, an empty walk would let the per-corpus tests pass vacuously.
    let yamlDocuments = 0;
    let writRecords = 0;
    const covered = new Set<string>();
    for (const { entry, manifest } of corpora) {
      const files = [...new Set(Object.values(manifest.locations).flat())]
        .flatMap((location) => expand(entry.path, location))
        .filter((file) => ownedBy(entry.path, file));
      for (const file of new Set(files)) {
        covered.add(entry.corpus_id);
        if (file.endsWith(".writ")) {
          writRecords += compileSource(readFileSync(file, "utf8"), { fileName: file }).records
            .length;
        } else {
          yamlDocuments += 1;
        }
      }
    }
    expect(covered.size).toBe(16);
    // Nine generated files across each of the thirteen reviewed corpora.
    expect(yamlDocuments).toBe(117);
    // Three constitutional drafts, six NIST drafts, three Commission function drafts.
    expect(writRecords).toBe(12);
  });

  for (const { entry, manifest } of corpora) {
    test(`${entry.corpus_id} declares a resolvable contract`, () => {
      const contract = manifest.record_contract;
      expect(contract.kind === "native" || contract.kind === "compatibility").toBe(true);
      expect(isKnownContract(contract.id)).toBe(true);
      // The declared kind must agree with where the contract actually lives.
      expect(contract.id.includes("/compatibility/")).toBe(contract.kind === "compatibility");
    });

    test(`${entry.corpus_id} record files satisfy the declared contract`, () => {
      const contract = manifest.record_contract;
      const files = [...new Set(Object.values(manifest.locations).flat())].flatMap((location) =>
        expand(entry.path, location),
      );
      const owned = [...new Set(files.filter((file) => ownedBy(entry.path, file)))].sort();
      expect(owned.length).toBeGreaterThan(0);

      for (const file of owned) {
        const label = relative(ROOT, file);
        const text = readFileSync(file, "utf8");
        if (file.endsWith(".writ")) {
          const parsed = parseDocument(text, { fileName: label });
          expect(parsed.ok, `${label} does not parse`).toBe(true);
          const compiled = compileSource(text, { fileName: label });
          expect(
            compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
            `${label} has compile errors`,
          ).toEqual([]);
          for (const record of compiled.records) {
            const result = validateContract(contract.id, record);
            expect(
              result.errors.map((issue) => `${label} ${issue.instancePath}: ${issue.message}`),
            ).toEqual([]);
          }
          continue;
        }
        const result = validateContract(contract.id, Bun.YAML.parse(text));
        expect(
          result.errors.map((issue) => `${label} ${issue.instancePath}: ${issue.message}`),
        ).toEqual([]);
      }
    });

    test(`${entry.corpus_id} out-of-corpus references belong to another catalogued corpus`, () => {
      const files = [...new Set(Object.values(manifest.locations).flat())].flatMap((location) =>
        expand(entry.path, location),
      );
      for (const file of files.filter((candidate) => !ownedBy(entry.path, candidate))) {
        const label = relative(ROOT, file);
        const owner = catalog.native_corpora.find(
          (candidate) => candidate !== entry && label.startsWith(`${candidate.path}/`),
        );
        expect(owner, `${label} is referenced but owned by no catalogued corpus`).toBeDefined();
      }
    });
  }
});

describe("a manifest cannot pass while its record files fail", () => {
  const reviewed = corpora.find(
    (candidate) =>
      candidate.entry.corpus_id ===
      "writ.corpus.legal-policy.eu.european-union.artificial-intelligence-act-2024-1689",
  )!;
  const claimsPath = join(ROOT, reviewed.entry.path, "records/claims.yaml");
  const claims = Bun.YAML.parse(readFileSync(claimsPath, "utf8")) as {
    claims: Record<string, unknown>[];
  };

  test("the reviewed claims are not native legal-policy v0.2 records", () => {
    // This is the defect the contract model exists to prevent: the manifest used to
    // advertise the native v0.2 grammar for a payload that cannot satisfy it.
    for (const claim of claims.claims) {
      expect(validate("legal-policy-record", claim).valid).toBe(false);
    }
    expect(reviewed.manifest.record_contract).toEqual({
      kind: "compatibility",
      id: "https://writ.example/schemas/compatibility/eu-us-ai-reviewed-v1/reviewed-corpus-document.schema.json",
      version: "1.0.0",
    });
  });

  test("declaring the native contract for this payload fails", () => {
    const native = "https://writ.example/schemas/extensions/legal-policy-record.schema.json";
    expect(validateContract(native, claims).valid).toBe(false);
  });

  test("an altered record file fails the declared contract", () => {
    const contract = reviewed.manifest.record_contract.id;
    expect(validateContract(contract, claims).valid).toBe(true);

    const unknownField = structuredClone(claims);
    unknownField.claims[0]!.invented_field = "x";
    expect(validateContract(contract, unknownField).valid).toBe(false);

    const droppedNote = structuredClone(claims);
    delete droppedNote.claims[0]!.interpretation_note;
    expect(validateContract(contract, droppedNote).valid).toBe(false);

    const changedWorkflow = structuredClone(claims);
    changedWorkflow.claims[0]!.review_status = "draft";
    expect(validateContract(contract, changedWorkflow).valid).toBe(false);
  });

  test("an unregistered contract id is an error, never a silent pass", () => {
    expect(() => validateContract("https://writ.example/schemas/core/not-a-contract", {})).toThrow(
      /Unknown record contract/,
    );
  });
});
