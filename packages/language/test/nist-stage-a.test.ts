/**
 * NIST Stage A: the reviewed institutional records, Core links and human-review
 * judgments produced by the approved Stage A review.
 *
 * Stage A implements only the decisions approved for the two already-registered
 * NIST sources. Every assertion here is either an approved decision or a boundary
 * the review drew deliberately: the absence of a mandate, decision-right or
 * capacity record means the reviewed evidence does not establish it, not that it
 * is false, so those absences are asserted as explicitly as the presences.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validate,
  validateJudgmentSupersession,
  type CurrentRecordJudgment,
  type RecordLink,
} from "@writ/domain";
import { compileSource } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const CORPUS = join(ROOT, "corpora/institutional/us/nist");

const INVENTORY = JSON.parse(
  readFileSync(
    join(ROOT, "docs/migrations/institutional-stage-b/pre-implementation-inventory.json"),
    "utf8",
  ),
) as {
  nist_stage_a: {
    sources_file: { bytes_base64: string; sha256: string };
    judgments_file: { bytes_base64: string };
    links: Array<{ path: string; bytes_base64: string }>;
  };
};

const AUTOMATED_DRAFT = "OpenAI Codex automated draft";
const IMPLEMENTATION = "Claude Code implementation of approved human review";

const read = (relativePath: string): string => readFileSync(join(CORPUS, relativePath), "utf8");
const yaml = <T>(relativePath: string): T => Bun.YAML.parse(read(relativePath)) as T;

interface Manifest {
  corpus_version: string;
  status: string;
  record_contract: { kind: string; id: string; version: string };
  locations: Record<string, string[]>;
  record_counts: Record<string, number>;
  review_counts: Record<string, number>;
}

const manifest = yaml<Manifest>("corpus.yaml");
const records = compileSource(read("records.writ"), { fileName: "records.writ" });
const judgmentDocument = compileSource(read("judgments.writ"), { fileName: "judgments.writ" });
// Every Stage A judgment is a v0.2 disposition, so the union narrows to the current shape.
const allJudgments = judgmentDocument.judgments as readonly CurrentRecordJudgment[];
const judgments = allJudgments.filter((judgment) => judgment.judgment_id.endsWith("_stage_a"));

const STAGE_A_RECORD_IDS = new Set([
  "nist_identity",
  "nist_organizational_placement",
  "nist_mission",
  "nist_measurement_science_function",
  "nist_ai_standards_development_function",
  "nist_ai_technical_guidance_function",
]);
const stageARecords = records.records.filter((target) => STAGE_A_RECORD_IDS.has(target.record_id));

const LINK_FILES = {
  part_of: "relationships/nist_department_of_commerce_relationship.yaml",
  supersedes: "relationships/nist_mission_supersedes_nist_measurement_science_function.yaml",
} as const;
const links = Object.fromEntries(
  Object.entries(LINK_FILES).map(([key, file]) => [key, yaml<RecordLink>(file)]),
) as Record<keyof typeof LINK_FILES, RecordLink>;

const byId = new Map(records.records.map((record) => [record.record_id, record]));

/** One compiled record, read as an open bag so absent payload keys can be asserted. */
type OpenRecord = Record<string, unknown> & { institutional_fact_type?: string };

const record = (id: string): OpenRecord => {
  const found = byId.get(id);
  expect(found, `${id} is missing`).toBeDefined();
  return found as unknown as OpenRecord;
};

/** Payload keys a v0.2 atomic record must not carry outside its own fact type. */
const PAYLOADS = [
  "mandate",
  "mission",
  "function",
  "functions",
  "decision_right",
  "decision_rights",
  "operational_capacity",
  "institution_type",
  "parent_institution_id",
  "record_link",
] as const;

function expectOnlyPayload(id: string, ...allowed: string[]): void {
  const target = record(id);
  for (const key of PAYLOADS) {
    if (allowed.includes(key)) {
      expect(target[key], `${id} should carry ${key}`).toBeDefined();
    } else {
      expect(target[key], `${id} should not carry ${key}`).toBeUndefined();
    }
  }
}

describe("corpus contract and status", () => {
  test("the manifest declares the native institutional v0.2 record contract", () => {
    expect(manifest.record_contract).toEqual({
      kind: "native",
      id: "https://writ.example/schemas/extensions/institutional-record.schema.json",
      version: "0.2.0",
    });
    expect(manifest.corpus_version).toBe("0.2.0");
  });

  test("record approval does not publish the corpus", () => {
    expect(manifest.status).toBe("draft");
  });

  test("records.writ uses Writ 0.2 and package version 0.2.0", () => {
    const text = read("records.writ");
    expect(text.startsWith('language writ "0.2"\n')).toBe(true);
    expect(text).toContain('package us.institutions.nist.records version "0.2.0";');
    expect(records.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(records.schemaValid).toBe(true);
  });

  test("the protected Stage A source bytes remain the exact prefix", () => {
    const baseline = Buffer.from(INVENTORY.nist_stage_a.sources_file.bytes_base64, "base64");
    const current = readFileSync(join(CORPUS, "sources.writ"));
    expect(current.subarray(0, baseline.length)).toEqual(baseline);
    expect(createHash("sha256").update(baseline).digest("hex")).toBe(
      INVENTORY.nist_stage_a.sources_file.sha256.replace("sha256:", ""),
    );
  });

  test("the eight protected judgment bytes and both relationship files are unchanged", () => {
    const judgmentBaseline = Buffer.from(
      INVENTORY.nist_stage_a.judgments_file.bytes_base64,
      "base64",
    );
    expect(
      readFileSync(join(CORPUS, "judgments.writ")).subarray(0, judgmentBaseline.length),
    ).toEqual(judgmentBaseline);
    for (const item of INVENTORY.nist_stage_a.links) {
      expect(readFileSync(join(ROOT, item.path))).toEqual(Buffer.from(item.bytes_base64, "base64"));
    }
  });

  test("the manifest routes each location category to its own files", () => {
    expect(manifest.locations).toEqual({
      sources: ["sources.writ", "sources/captures/"],
      passages: ["sources.writ", "records.writ"],
      records: ["records.writ"],
      relationships: [
        LINK_FILES.part_of,
        "relationships/nist_lab_network_capacity_v2_supersedes_nist_lab_network_capacity.yaml",
        LINK_FILES.supersedes,
      ],
      judgments: ["judgments.writ"],
      migration: ["migration.yaml"],
    });
  });
});

describe("approved atomic records", () => {
  test("nist_identity is an atomic identity record", () => {
    const identity = record("nist_identity");
    expect(validate("institutional-record", identity).valid).toBe(true);
    expect(identity.institutional_fact_type).toBe("identity");
    expect(identity.review_state).toBe("approved");
    expect(identity.institution_type).toBe("federal_agency");
    expect((identity.assertion as { mode: string }).mode).toBe("defines");
  });

  test("nist_identity carries no mandate, function, placement or capacity payload", () => {
    expectOnlyPayload("nist_identity", "institution_type");
  });

  test("nist_organizational_placement is an atomic placement record", () => {
    const placement = record("nist_organizational_placement");
    expect(validate("institutional-record", placement).valid).toBe(true);
    expect(placement.institutional_fact_type).toBe("placement");
    expect(placement.review_state).toBe("approved");
    expect((placement.assertion as { mode: string }).mode).toBe("states");
  });

  test("the placement record names the Department of Commerce as parent", () => {
    expect(record("nist_organizational_placement").parent_institution_id).toBe(
      "department_of_commerce",
    );
  });

  test("the placement record carries no identity, mandate, function or capacity payload", () => {
    expectOnlyPayload("nist_organizational_placement", "parent_institution_id");
  });

  test("nist_mission is an atomic mission record", () => {
    const mission = record("nist_mission");
    expect(validate("institutional-record", mission).valid).toBe(true);
    expect(mission.institutional_fact_type).toBe("mission");
    expect(mission.review_state).toBe("approved");
    expect((mission.assertion as { mode: string }).mode).toBe("states");
    expect(mission.mission).toMatchObject({
      source_ids: ["nist.about"],
      evidence_refs: ["nist.about.mission"],
    });
  });

  test("nist_mission asserts no legal mandate, decision rights or operational capacity", () => {
    expectOnlyPayload("nist_mission", "mission");
    const mission = record("nist_mission");
    const text = JSON.stringify(mission).toLowerCase();
    expect(text).not.toContain("statutory authority");
    // The boundary is stated rather than implied.
    const uncertainties = mission.uncertainties as { description: string }[];
    expect(
      uncertainties.some((item) =>
        /does not independently establish statutory mandate/.test(item.description),
      ),
    ).toBe(true);
  });

  test("both AI group records are atomic function records", () => {
    for (const [id, fn] of [
      ["nist_ai_technical_guidance_function", "technical_guidance"],
      ["nist_ai_standards_development_function", "standards_development"],
    ] as const) {
      const target = record(id);
      expect(validate("institutional-record", target).valid).toBe(true);
      expect(target.institutional_fact_type).toBe("function");
      expect(target.function).toBe(fn);
      expect(target.review_state).toBe("approved");
      expect(target.institution_id).toBe("nist.ai_standards_guidelines_group");
    }
  });

  test("neither function record carries mandate, capacity, identity or parent placement", () => {
    expectOnlyPayload("nist_ai_technical_guidance_function", "function");
    expectOnlyPayload("nist_ai_standards_development_function", "function");
  });

  test("the standards-development passage stays classified as a function, not a mission", () => {
    const target = record("nist_ai_standards_development_function");
    expect(target.institutional_fact_type).toBe("function");
    expect(target.institutional_fact_type).not.toBe("mission");
    expect(target.mission).toBeUndefined();
  });
});

describe("the superseded historical record", () => {
  test("nist_measurement_science_function remains resolvable as superseded", () => {
    const historical = record("nist_measurement_science_function");
    expect(validate("institutional-record", historical).valid).toBe(true);
    expect(historical.review_state).toBe("superseded");
    expect(historical.institutional_fact_type).toBe("function");
    expect(historical.function).toBe("measurement_science");
  });

  test("it keeps its original assertion, evidence and automated provenance", () => {
    const historical = record("nist_measurement_science_function");
    expect(historical.assertion).toEqual({
      mode: "performs",
      text: "NIST advances measurement science as part of its source-reported mission.",
    });
    expect(historical.provenance).toEqual({
      created_by: AUTOMATED_DRAFT,
      created_at: "2026-08-03",
    });
    expect(historical.evidence).toEqual([
      {
        source_id: "nist.about",
        document_version_id: "nist.about.v2022_01_11",
        passage_id: "nist.about.mission",
        locator: "About NIST, Mission",
        quote:
          "To promote U.S. innovation and industrial competitiveness by advancing measurement science, standards, and technology in ways that enhance economic security and improve our quality of life.",
        passage_hash: "sha256:b7c73bafbedd9701baee1cadf74dc7668b215f3d6f5d19d6b6d51a179120c219",
        document_hash: "sha256:a1a85280232b9e49eed4f5e26dfca894cd76eefb00ba964ce05a5bf1e36970f2",
        basis: "direct",
      },
    ]);
  });

  test("no record carries a record-level superseded_by field", () => {
    for (const target of records.records) {
      expect(target).not.toHaveProperty("superseded_by");
      expect(target).not.toHaveProperty("derived_from_record_id");
    }
  });
});

describe("Core record links", () => {
  test("the Department of Commerce relationship is a standalone Core link, not a record", () => {
    expect(existsSync(join(CORPUS, LINK_FILES.part_of))).toBe(true);
    expect(validate("record-link", links.part_of).valid).toBe(true);
    expect(byId.has("nist_department_of_commerce_relationship")).toBe(false);
    expect(read("records.writ")).not.toContain("nist_department_of_commerce_relationship");
    expect(links.part_of.review_state).toBe("approved");
  });

  test("it uses part_of and preserves its original automated provenance", () => {
    expect(links.part_of.relation_type).toBe("part_of");
    expect(links.part_of.source_id).toBe("nist");
    expect(links.part_of.target_id).toBe("department_of_commerce");
    expect(links.part_of.provenance).toEqual({
      created_by: AUTOMATED_DRAFT,
      created_at: "2026-08-03",
    });
  });

  test("it cites the placement record as its supporting fact", () => {
    expect(links.part_of.supporting_record_ids).toEqual(["nist_organizational_placement"]);
    // The supporting record is the authoritative assertion and exists.
    expect(byId.has("nist_organizational_placement")).toBe(true);
  });

  test("no inverse duplicate link is stored", () => {
    for (const link of Object.values(links)) {
      const inverse =
        link.source_id === links.part_of.target_id && link.target_id === links.part_of.source_id;
      expect(inverse).toBe(false);
      expect(["has_part", "contains", "superseded_by"]).not.toContain(link.relation_type);
    }
    expect(Object.values(links)).toHaveLength(2);
  });

  test("the supersession link points from the mission record to the historical function", () => {
    expect(validate("record-link", links.supersedes).valid).toBe(true);
    expect(links.supersedes.relation_type).toBe("supersedes");
    expect(links.supersedes.source_id).toBe("nist_mission");
    expect(links.supersedes.target_id).toBe("nist_measurement_science_function");
    expect(links.supersedes.source_kind).toBe("record");
    expect(links.supersedes.target_kind).toBe("record");
    expect(links.supersedes.review_state).toBe("approved");
  });

  test("both link endpoints resolve to records or declared institutions", () => {
    expect(byId.has(links.supersedes.source_id)).toBe(true);
    expect(byId.has(links.supersedes.target_id)).toBe(true);
    expect(links.part_of.source_kind).toBe("institution");
    expect(links.part_of.target_kind).toBe("institution");
  });
});

describe("Stage A exclusions", () => {
  const factTypes = () =>
    stageARecords.map((r) => (r as { institutional_fact_type?: string }).institutional_fact_type);

  test("no Stage A record exists for mandate, decision rights or operational capacity", () => {
    for (const excluded of ["mandate", "decision_right", "operational_capacity"]) {
      expect(factTypes()).not.toContain(excluded);
    }
    for (const target of stageARecords) {
      expect(target).not.toHaveProperty("mandate");
      expect(target).not.toHaveProperty("decision_right");
      expect(target).not.toHaveProperty("operational_capacity");
    }
  });

  test("no AI-group identity or placement record exists", () => {
    const group = stageARecords.filter(
      (r) =>
        (r as { institution_id?: string }).institution_id === "nist.ai_standards_guidelines_group",
    );
    expect(group).toHaveLength(2);
    for (const target of group) {
      expect((target as { institutional_fact_type?: string }).institutional_fact_type).toBe(
        "function",
      );
      expect(target).not.toHaveProperty("parent_institution_id");
      expect(target).not.toHaveProperty("institution_type");
      expect(target).not.toHaveProperty("mission");
    }
  });

  test("no placeholder unknown payload was used to fill an unsupported category", () => {
    expect(read("records.writ")).not.toContain("status unknown;");
  });
});

describe("evidence preservation", () => {
  test("the two original source IDs are unchanged", () => {
    const sources = read("sources.writ");
    expect(sources).toContain("source_id nist.about;");
    expect(sources).toContain("source_id nist.ai_standards_group;");
    const used = new Set(stageARecords.flatMap((r) => r.evidence.map((e) => e.source_id)));
    expect([...used].sort()).toEqual(["nist.about", "nist.ai_standards_group"]);
  });

  test("every document and passage hash is unchanged", () => {
    const expected = new Map([
      [
        "nist.about.identity",
        "sha256:4cc104fbe6573c0c72f80cf978e68e9661374d64bd67c855a571edb58ac65277",
      ],
      [
        "nist.about.mission",
        "sha256:b7c73bafbedd9701baee1cadf74dc7668b215f3d6f5d19d6b6d51a179120c219",
      ],
      [
        "nist.ai_standards_group.standards",
        "sha256:ec5b9883154946b69ee3623b9e7394501ced98354288e4167a2eedf4c31609b8",
      ],
      [
        "nist.ai_standards_group.guidance",
        "sha256:7a9c75b43200b400de56a5c983cc3c13c2127122e33a86ad8169548ef405f903",
      ],
    ]);
    const documents = new Map([
      ["nist.about", "sha256:a1a85280232b9e49eed4f5e26dfca894cd76eefb00ba964ce05a5bf1e36970f2"],
      [
        "nist.ai_standards_group",
        "sha256:770642cfb32c44bbba3c64daa23e3d883c8f6a547038ac11ebcdfb8f2c629e96",
      ],
    ]);
    const seen = new Set<string>();
    for (const target of stageARecords) {
      for (const item of target.evidence) {
        seen.add(item.passage_id);
        expect(expected.has(item.passage_id), `unknown passage ${item.passage_id}`).toBe(true);
        expect(item.passage_hash).toBe(expected.get(item.passage_id)!);
        expect(item.document_hash).toBe(documents.get(item.source_id)!);
      }
    }
    expect([...seen].sort()).toEqual([...expected.keys()].sort());
  });

  test("the exact mission quotation is preserved, not replaced by the assertion", () => {
    const mission = record("nist_mission");
    const evidence = (mission.evidence as { quote: string }[])[0]!;
    expect(evidence.quote).toBe(
      "To promote U.S. innovation and industrial competitiveness by advancing measurement science, standards, and technology in ways that enhance economic security and improve our quality of life.",
    );
    expect(evidence.quote).not.toBe((mission.assertion as { text: string }).text);
  });
});

describe("provenance", () => {
  test("the five carried-over records keep their automated draft provenance", () => {
    const carried = [
      "nist_identity",
      "nist_organizational_placement",
      "nist_measurement_science_function",
      "nist_ai_standards_development_function",
      "nist_ai_technical_guidance_function",
    ];
    for (const id of carried) {
      expect(record(id).provenance).toEqual({
        created_by: AUTOMATED_DRAFT,
        created_at: "2026-08-03",
      });
    }
  });

  test("the new mission record does not claim original automated-draft provenance", () => {
    const provenance = record("nist_mission").provenance as { created_by: string };
    expect(provenance.created_by).toBe(IMPLEMENTATION);
    expect(provenance.created_by).not.toBe(AUTOMATED_DRAFT);
    expect(links.supersedes.provenance.created_by).toBe(IMPLEMENTATION);
  });
});

describe("human-review judgments", () => {
  test("exactly eight judgments exist and all are accepted", () => {
    expect(judgments).toHaveLength(8);
    expect(judgmentDocument.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    for (const judgment of judgments) {
      expect(validate("record-judgment", judgment).valid).toBe(true);
      expect(judgment.status).toBe("accepted");
      expect(judgment.schema_version).toBe("0.2.0");
    }
  });

  test("the five approved records and two approved links have value approved", () => {
    const approved = judgments.filter((judgment) => judgment.value === "approved");
    expect(approved).toHaveLength(7);
    expect(approved.map((judgment) => judgment.target_id).sort()).toEqual([
      "nist_ai_standards_development_function",
      "nist_ai_technical_guidance_function",
      "nist_department_of_commerce_relationship",
      "nist_identity",
      "nist_mission",
      "nist_mission_supersedes_nist_measurement_science_function",
      "nist_organizational_placement",
    ]);
  });

  test("the historical function record has value superseded", () => {
    const superseded = judgments.filter((judgment) => judgment.value === "superseded");
    expect(superseded).toHaveLength(1);
    expect(superseded[0]!.target_id).toBe("nist_measurement_science_function");
  });

  test("every judgment resolves to its target", () => {
    const linkIds = new Set(Object.values(links).map((link) => link.link_id));
    for (const judgment of judgments) {
      if (judgment.target_kind === "record") {
        expect(byId.has(judgment.target_id), `${judgment.target_id} is not a record`).toBe(true);
        expect(judgment.judgment_type).toBe("review_disposition");
      } else {
        expect(linkIds.has(judgment.target_id), `${judgment.target_id} is not a link`).toBe(true);
        expect(judgment.judgment_type).toBe("record_link_disposition");
      }
      expect(judgment.evidence_refs.length).toBeGreaterThan(0);
    }
    expect(new Set(judgments.map((judgment) => judgment.target_id)).size).toBe(8);
  });

  test("the reviewer is represented consistently as Sara Kim", () => {
    expect(new Set(judgments.map((judgment) => judgment.reviewer))).toEqual(new Set(["Sara Kim"]));
    for (const judgment of judgments) {
      expect(judgment.created_at).toBe("2026-08-04");
      expect(judgment.family_context).toBe("institutional");
    }
  });

  test("these are first dispositions, so no judgment supersedes another", () => {
    for (const judgment of judgments) {
      expect(judgment).not.toHaveProperty("supersedes_judgment_ids");
      expect(judgment).not.toHaveProperty("superseded_by_judgment_id");
    }
    expect(validateJudgmentSupersession(judgments).valid).toBe(true);
  });

  test("each rationale states the transition and the distinction it turned on", () => {
    for (const judgment of judgments) {
      expect(judgment.rationale.length).toBeGreaterThan(80);
      expect(/draft to (approved|superseded)|approves this new/.test(judgment.rationale)).toBe(
        true,
      );
    }
  });
});

describe("final Stage A inventory", () => {
  test("the corpus contains exactly six institutional records", () => {
    expect(stageARecords).toHaveLength(6);
    for (const target of stageARecords) expect(target.family).toBe("institutional");
  });

  test("five records are approved and one is superseded", () => {
    const states = stageARecords.map((target) => target.review_state);
    expect(states.filter((state) => state === "approved")).toHaveLength(5);
    expect(states.filter((state) => state === "superseded")).toHaveLength(1);
    expect(states).not.toContain("draft");
    // `accepted` is a judgment status, never a record review state.
    expect(states).not.toContain("accepted");
  });

  test("exactly two Core record links are approved", () => {
    const states = Object.values(links).map((link) => link.review_state);
    expect(states).toEqual(["approved", "approved"]);
    for (const link of Object.values(links)) {
      expect(link.owning_corpus_id).toBe("us.institutions.nist");
    }
  });

  test("no legal-policy NIST publication was moved into the institutional corpus", () => {
    for (const target of stageARecords) {
      expect(target.family).not.toBe("legal_policy");
      expect(target).not.toHaveProperty("instrument_type");
      expect(target).not.toHaveProperty("official_citation");
    }
    expect(existsSync(join(ROOT, "corpora/legal-policy/us/nist/records.writ"))).toBe(false);
  });

  test("the migration ledger records every previous object and its final treatment", () => {
    const ledger = yaml<{ entries: { previous_object: string | null; final_object: string }[] }>(
      "migration.yaml",
    );
    const stageAEntries = ledger.entries.slice(0, 8);
    expect(stageAEntries).toHaveLength(8);
    const previous = stageAEntries.map((entry) => entry.previous_object).filter(Boolean);
    expect(previous.sort()).toEqual([
      "nist_ai_standards_development_function",
      "nist_ai_technical_guidance_function",
      "nist_department_of_commerce_relationship",
      "nist_identity",
      "nist_measurement_science_function",
      "nist_organizational_placement",
    ]);
    const final = stageAEntries.map((entry) => entry.final_object);
    expect(final).toContain("nist_mission");
    expect(final).toContain("nist_mission_supersedes_nist_measurement_science_function");
    expect(new Set(final).size).toBe(8);
  });
});
