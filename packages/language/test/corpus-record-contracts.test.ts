/**
 * The manifest-to-record gate.
 *
 * A corpus manifest declares one `record_contract`. This loads every catalogued
 * manifest and validates the files it lists against exactly the contract that
 * governs them. A manifest cannot pass because its own structure is valid while
 * the files it points at fail the contract it names.
 *
 * Validation is routed by `locations` category, because a manifest lists more than
 * records. For a corpus whose contract is a per-object grammar:
 *
 *   locations.records        -> the manifest's declared record contract
 *   locations.relationships  -> schemas/core/record-link.schema.json
 *   locations.judgments      -> schemas/analysis/record-judgment.schema.json
 *   locations.sources        -> not validated as records
 *   locations.passages       -> not validated as records
 *   locations.migration      -> not validated as records
 *
 * A preserved compatibility payload is different: its contract is document-level and
 * already describes every file kind the corpus lists, including its relationship,
 * review and ledger documents. Those corpora keep whole-manifest coverage against
 * that one contract, since routing them to the Core object contracts would check
 * imported documents against grammars they were never written to.
 *
 * `.writ` files are compiled first, and their lowered records or judgments are
 * validated, so the native-grammar corpora are held to the same rule as the YAML ones.
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

const CORE_RECORD_LINK = "https://writ.example/schemas/core/record-link.schema.json";
const RECORD_JUDGMENT = "https://writ.example/schemas/analysis/record-judgment.schema.json";

/**
 * Contracts that describe a whole preserved corpus payload rather than one object
 * kind. Every file such a corpus lists is governed by the single declared contract.
 */
const DOCUMENT_LEVEL_CONTRACTS = new Set([
  "https://writ.example/schemas/compatibility/eu-us-ai-reviewed-v1/reviewed-corpus-document.schema.json",
]);

/** The contract governing one `locations` category, or null when it holds no records. */
function contractFor(manifest: Manifest, category: string): string | null {
  const declared = manifest.record_contract.id;
  if (DOCUMENT_LEVEL_CONTRACTS.has(declared)) return declared;
  if (category === "records") return declared;
  if (category === "relationships") return CORE_RECORD_LINK;
  if (category === "judgments") return RECORD_JUDGMENT;
  return null;
}

/** Every owned file the manifest lists, paired with the contract that governs it. */
function routedFiles(
  entry: CatalogEntry,
  manifest: Manifest,
): { file: string; contract: string }[] {
  const routed = new Map<string, string>();
  for (const [category, locations] of Object.entries(manifest.locations)) {
    const contract = contractFor(manifest, category);
    if (contract === null) continue;
    for (const location of locations) {
      for (const file of expand(entry.path, location)) {
        if (ownedBy(entry.path, file)) routed.set(file, contract);
      }
    }
  }
  return [...routed].sort().map(([file, contract]) => ({ file, contract }));
}

/** Validate one file against `contract`, returning human-readable failures. */
function checkFile(file: string, contract: string): string[] {
  const label = relative(ROOT, file);
  const text = readFileSync(file, "utf8");
  if (!file.endsWith(".writ")) {
    return validateContract(contract, Bun.YAML.parse(text)).errors.map(
      (issue) => `${label} ${issue.instancePath}: ${issue.message}`,
    );
  }
  const parsed = parseDocument(text, { fileName: label });
  if (!parsed.ok) return [`${label} does not parse`];
  const compiled = compileSource(text, { fileName: label });
  const failures = compiled.diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => `${label} compile error: ${diagnostic.message}`);
  const objects: readonly unknown[] =
    contract === RECORD_JUDGMENT ? compiled.judgments : compiled.records;
  for (const object of objects) {
    failures.push(
      ...validateContract(contract, object).errors.map(
        (issue) => `${label} ${issue.instancePath}: ${issue.message}`,
      ),
    );
  }
  return failures;
}

describe("every catalogued manifest declares the contract its record files satisfy", () => {
  test("the catalog is not empty and matches the manifests it points at", () => {
    expect(corpora).toHaveLength(16);
    for (const { entry, manifest } of corpora) {
      expect(manifest.corpus_id).toBe(entry.corpus_id);
      expect(manifest.family).toBe(entry.family);
    }
  });

  test("the gate actually validates every corpus and every routed file kind", () => {
    // Without this, an empty walk would let the per-corpus tests pass vacuously.
    let yamlDocuments = 0;
    let writRecords = 0;
    let writJudgments = 0;
    let linkDocuments = 0;
    const covered = new Set<string>();
    for (const { entry, manifest } of corpora) {
      for (const { file, contract } of routedFiles(entry, manifest)) {
        covered.add(entry.corpus_id);
        if (!file.endsWith(".writ")) {
          yamlDocuments += 1;
          if (contract === CORE_RECORD_LINK) linkDocuments += 1;
          continue;
        }
        const compiled = compileSource(readFileSync(file, "utf8"), { fileName: file });
        if (contract === RECORD_JUDGMENT) writJudgments += compiled.judgments.length;
        else writRecords += compiled.records.length;
      }
    }
    expect(covered.size).toBe(16);
    // Nine generated files across each of the thirteen reviewed corpora, plus the
    // seven approved institutional Core links and three approved cross-family links.
    expect(yamlDocuments).toBe(117 + 10);
    expect(linkDocuments).toBe(10);
    // Three constitutional drafts, nineteen NIST records, and twenty Commission records.
    expect(writRecords).toBe(42);
    // Existing judgments, preserved superseded decisions, and accepted human dispositions.
    expect(writJudgments).toBe(52);
  });

  for (const { entry, manifest } of corpora) {
    test(`${entry.corpus_id} declares a resolvable contract`, () => {
      const contract = manifest.record_contract;
      expect(contract.kind === "native" || contract.kind === "compatibility").toBe(true);
      expect(isKnownContract(contract.id)).toBe(true);
      // The declared kind must agree with where the contract actually lives.
      expect(contract.id.includes("/compatibility/")).toBe(contract.kind === "compatibility");
    });

    test(`${entry.corpus_id} record files satisfy the contract that governs them`, () => {
      const routed = routedFiles(entry, manifest);
      expect(routed.length).toBeGreaterThan(0);
      for (const { file, contract } of routed) {
        expect(checkFile(file, contract)).toEqual([]);
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

  test("validation is routed by location category, not by mere presence in the manifest", () => {
    const nist = corpora.find(({ entry }) => entry.corpus_id === "us.institutions.nist")!;
    const { manifest } = nist;
    expect(manifest.record_contract.kind).toBe("native");

    expect(contractFor(manifest, "records")).toBe(manifest.record_contract.id);
    expect(contractFor(manifest, "relationships")).toBe(CORE_RECORD_LINK);
    expect(contractFor(manifest, "judgments")).toBe(RECORD_JUDGMENT);
    for (const category of ["sources", "passages", "migration"]) {
      expect(contractFor(manifest, category)).toBeNull();
    }

    // `sources.writ` is listed under sources and passages, and is never checked as
    // an institutional record. `migration.yaml` is likewise not a record file.
    const routed = new Map(
      routedFiles(nist.entry, manifest).map((r) => [relative(ROOT, r.file), r.contract]),
    );
    expect([...routed.keys()].sort()).toEqual([
      "corpora/institutional/us/nist/judgments.writ",
      "corpora/institutional/us/nist/records.writ",
      "corpora/institutional/us/nist/relationships/nist_ai_measurement_function_supersedes_nist_ai_measurement_capacity.yaml",
      "corpora/institutional/us/nist/relationships/nist_ai_standards_group_placement_v2_supersedes_nist_ai_standards_group_placement.yaml",
      "corpora/institutional/us/nist/relationships/nist_aml_facility_capacity_v2_supersedes_nist_aml_facility_capacity.yaml",
      "corpora/institutional/us/nist/relationships/nist_department_of_commerce_relationship.yaml",
      "corpora/institutional/us/nist/relationships/nist_lab_network_capacity_v2_supersedes_nist_lab_network_capacity.yaml",
      "corpora/institutional/us/nist/relationships/nist_mission_supersedes_nist_measurement_science_function.yaml",
    ]);

    // Routing is what makes this correct. A record link is not an institutional
    // record and fails the manifest's own contract outright.
    const declared = manifest.record_contract.id;
    for (const [file, contract] of routed) {
      if (contract !== CORE_RECORD_LINK) continue;
      expect(checkFile(join(ROOT, file), declared).length).toBeGreaterThan(0);
    }

    // Judgments are the subtler case, and the reason routing must be by category
    // rather than by file: `judgments.writ` lowers to judgments and no records, so
    // checking it "as records" inspects nothing and passes vacuously. Routed to the
    // judgment contract it is really checked; routed to the record contract the
    // judgment objects fail.
    const judgmentsPath = join(ROOT, "corpora/institutional/us/nist/judgments.writ");
    const compiled = compileSource(readFileSync(judgmentsPath, "utf8"), {
      fileName: judgmentsPath,
    });
    expect(compiled.records).toHaveLength(0);
    expect(compiled.judgments).toHaveLength(25);
    expect(checkFile(judgmentsPath, RECORD_JUDGMENT)).toEqual([]);
    for (const judgment of compiled.judgments) {
      expect(validateContract(declared, judgment).valid).toBe(false);
    }
  });
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
