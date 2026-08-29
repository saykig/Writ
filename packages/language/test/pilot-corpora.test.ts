import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validate, type LegalPolicyRecord } from "@writ/domain";
import { compileSource } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

function writFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? writFiles(path) : path.endsWith(".writ") ? [path] : [];
  });
}

describe("Stage 1 pilot corpora", () => {
  test("checked-in constitutional sample records compile and remain draft without topics", () => {
    const files = writFiles(join(ROOT, "corpora/legal-policy/us/constitutional-law")).filter(
      (path) => !path.endsWith("corpus.writ") && !path.endsWith("vocabulary.writ"),
    );
    const records = files.flatMap(
      (path) => compileSource(readFileSync(path, "utf8"), { fileName: path }).records,
    );
    expect(files).toHaveLength(3);
    expect(records).toHaveLength(3);
    for (const record of records) {
      expect(record.family).toBe("legal_policy");
      expect(record.review_state).toBe("draft");
      expect(record.topics).toEqual([]);
      if (record.family === "legal_policy") {
        const legal = record as LegalPolicyRecord;
        expect(legal.force).toBe("unknown");
        expect(legal.applicability_status).toBe("unknown");
        expect(legal.enforcement_status).toBe("unknown");
      }
    }
  });

  test("NIST records preserve exact evidence and institutional semantics", () => {
    const path = join(ROOT, "corpora/institutional/us/nist/records.writ");
    const compiled = compileSource(readFileSync(path, "utf8"), { fileName: path });
    expect(compiled.schemaValid).toBe(true);
    expect(compiled.records).toHaveLength(19);
    // Stage A human review dispositioned these six records and moved them onto the
    // native atomic contract, so the v0.1 draft state and its placeholder mandate and
    // capacity payloads are gone. What this test still guards is the evidence layer:
    // the exact quotations below must survive every review. The dispositions
    // themselves are asserted in `nist-stage-a.test.ts`.
    const stageAIds = new Set([
      "nist_identity",
      "nist_organizational_placement",
      "nist_mission",
      "nist_measurement_science_function",
      "nist_ai_standards_development_function",
      "nist_ai_technical_guidance_function",
    ]);
    const stageA = compiled.records.filter((record) => stageAIds.has(record.record_id));
    expect(stageA).toHaveLength(6);
    for (const record of stageA) {
      expect(record.family).toBe("institutional");
      expect(["approved", "superseded"]).toContain(record.review_state);
      expect(record.evidence.length).toBeGreaterThan(0);
      expect(validate("legal-policy-record", record).valid).toBe(false);
      expect(record).not.toHaveProperty("mandate");
      expect(record).not.toHaveProperty("operational_capacity");
    }
    expect(
      stageA.filter((record) => record.provenance.created_by === "OpenAI Codex automated draft"),
    ).toHaveLength(5);
    const ai = stageA.filter((record) => record.topics.includes("artificial_intelligence"));
    expect(ai).toHaveLength(2);
    expect(
      stageA.filter((record) => "mission" in record && record.mission !== undefined),
    ).toHaveLength(1);
    expect(
      ai.every((record) => record.assertion.text.includes("AI") || record.title.includes("AI")),
    ).toBe(true);
    expect(
      new Set(stageA.flatMap((record) => record.evidence.map((evidence) => evidence.quote))),
    ).toEqual(
      new Set([
        "The National Institute of Standards and Technology (NIST) was founded in 1901 and is now part of the U.S. Department of Commerce.",
        "To promote U.S. innovation and industrial competitiveness by advancing measurement science, standards, and technology in ways that enhance economic security and improve our quality of life.",
        "In addition to developing its own publications, the Group leads NIST's participation in the development of voluntary consensus standards, including international standards, that promote innovation and trustworthiness in systems and organizations that use AI.",
        "The Artificial Intelligence (AI) Standards and Guidelines Group develops technical resources and guidelines that help organizations to develop, deploy, and use AI with confidence, enabling U.S. industry to position itself at the forefront of technology development and AI governance.",
      ]),
    );
  });
});
