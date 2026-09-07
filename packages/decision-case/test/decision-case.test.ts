import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256Bytes } from "@writ/provenance";

import {
  assessReuse,
  consumeDecision,
  DecisionCaseError,
  encodedBytes,
  exactJsonBytes,
  executionBytes,
  exportDecisionCase,
  openDecisionCase,
  parseExecution,
  runDecisionCase,
  type DecisionCase,
  type DecisionExecution,
} from "../src/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CASE_PATH = join(
  ROOT,
  "decision-cases",
  "synthetic-failure-choice",
  "synthetic-failure-choice.case.json",
);
const CASE_BYTES = readFileSync(CASE_PATH);

function mutableCase(): DecisionCase {
  return JSON.parse(new TextDecoder().decode(CASE_BYTES)) as DecisionCase;
}

function reopen(value: DecisionCase) {
  return openDecisionCase(exactJsonBytes(value));
}

function expectCode(action: () => unknown, code: DecisionCaseError["code"]): void {
  try {
    action();
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(DecisionCaseError);
    expect((error as DecisionCaseError).code).toBe(code);
  }
}

describe("portable decision case", () => {
  test("opens, exports, and reopens exact portable bytes", () => {
    const opened = openDecisionCase(CASE_BYTES);
    const exported = exportDecisionCase(opened);
    expect(exported).toEqual(new Uint8Array(CASE_BYTES));
    expect(openDecisionCase(exported).case_sha256).toBe(opened.case_sha256);
    expect(opened.value.analyses.map(({ analysis_id }) => analysis_id)).toEqual([
      "revision-0",
      "revision-1",
      "revision-2",
      "control-simultaneous-a-bounds",
    ]);
    expect(opened.value.interpretation_control).toEqual({
      alternative_scenarios: ["revision-1", "revision-2"],
      simultaneous_constraints: "control-simultaneous-a-bounds",
    });
  });

  test("snapshots inputs and freezes semantic subjects", () => {
    const bytes = new Uint8Array(CASE_BYTES);
    const opened = openDecisionCase(bytes);
    bytes.fill(0);
    expect(opened.value.case_id).toBe("writ.case.synthetic-failure-choice");
    expect(() => {
      (opened.value.analyses as unknown as unknown[]).pop();
    }).toThrow();
    expect(openDecisionCase(exportDecisionCase(opened)).value.case_id).toBe(opened.value.case_id);
  });

  test("rejects an actual-span mismatch even when a quote hash is plausible", () => {
    const value = mutableCase();
    const first = value.source_references[0] as unknown as {
      byte_span: { start: number; end: number };
    };
    first.byte_span.start += 1;
    first.byte_span.end += 1;
    expectCode(() => reopen(value), "DECISION_CASE_EVIDENCE_SPAN_MISMATCH");
  });

  test("rejects malformed source identity and undeclared model input", () => {
    const malformed = mutableCase();
    (malformed.source_documents[0] as unknown as { sha256: string }).sha256 =
      `sha256:${"0".repeat(64)}`;
    expectCode(() => reopen(malformed), "DECISION_CASE_INVALID");

    const unmapped = mutableCase();
    (unmapped.analyses[0]!.model_mappings as unknown as unknown[]).pop();
    expectCode(() => reopen(unmapped), "DECISION_CASE_MODEL_INPUT_UNDECLARED");
  });

  test("refuses unknown semantics and unsupported operations", () => {
    for (const [field, replacement, code] of [
      ["semantics", "finite-linear-uncertainty.v9", "DECISION_CASE_UNSUPPORTED_SEMANTICS"],
      ["operation", "conditional_range", "DECISION_CASE_UNSUPPORTED_OPERATION"],
    ] as const) {
      const value = mutableCase();
      const analysis = value.analyses[0]!;
      const query = JSON.parse(
        Buffer.from(analysis.mathematical_subject.query.content, "base64").toString("utf8"),
      ) as Record<string, unknown>;
      query[field] = replacement;
      (
        analysis.mathematical_subject as unknown as { query: ReturnType<typeof encodedBytes> }
      ).query = encodedBytes(exactJsonBytes(query));
      expectCode(() => reopen(value), code);
    }
  });

  test("rejects dependency cycles", () => {
    const value = mutableCase();
    const subject = value.analyses[0]!.dependencies.find(
      ({ dependency_id }) => dependency_id === "subject.problem",
    )! as unknown as { depends_on: string[] };
    subject.depends_on.push("use.checked");
    expectCode(() => reopen(value), "DECISION_CASE_DEPENDENCY_CYCLE");
  });

  test("preserves exact rational and non-normalized Unicode problem bytes", () => {
    const decomposed = mutableCase();
    const analysis = decomposed.analyses[0]!;
    const problem = JSON.parse(
      Buffer.from(analysis.mathematical_subject.problem.content, "base64").toString("utf8"),
    ) as Record<string, unknown>;
    problem.family_label = "Cafe\u0301";
    const decomposedBytes = exactJsonBytes(problem);
    (
      analysis.mathematical_subject as unknown as { problem: ReturnType<typeof encodedBytes> }
    ).problem = encodedBytes(decomposedBytes);
    const opened = reopen(decomposed);
    const preserved = Buffer.from(
      opened.value.analyses[0]!.mathematical_subject.problem.content,
      "base64",
    );
    expect(preserved).toEqual(Buffer.from(decomposedBytes));
    expect(preserved.toString("utf8")).toContain('"rhs":"-1/5"');

    const composed = JSON.parse(JSON.stringify(problem)) as Record<string, unknown>;
    composed.family_label = "Caf\u00e9";
    expect(sha256Bytes(exactJsonBytes(composed))).not.toBe(sha256Bytes(decomposedBytes));
  });

  test("revision comparison distinguishes changed math from source-only reassessment", () => {
    const base = openDecisionCase(CASE_BYTES);
    const changedLoss = assessReuse(base, "revision-0", base, "revision-1");
    expect(changedLoss.mathematical_subject_changed).toBe(true);
    expect(changedLoss.mathematical_check_reusable).toBe(false);
    expect(changedLoss.changed_dependencies).toContain("source.penalty");

    const sourceOnlyValue = mutableCase();
    const source = sourceOnlyValue.source_documents[0] as unknown as {
      content: string;
      sha256: string;
      document_version_id: string;
    };
    const changedSourceBytes = Buffer.concat([
      Buffer.from(source.content, "base64"),
      Buffer.from("Source-only correction marker.\n", "utf8"),
    ]);
    source.content = changedSourceBytes.toString("base64");
    source.sha256 = sha256Bytes(changedSourceBytes);
    source.document_version_id = "synthetic-parameters.v2";
    for (const reference of sourceOnlyValue.source_references as unknown as Array<{
      document_hash: string;
      document_version_id: string;
    }>) {
      reference.document_hash = source.sha256;
      reference.document_version_id = source.document_version_id;
    }
    const sourceOnly = reopen(sourceOnlyValue);
    const assessment = assessReuse(base, "revision-0", sourceOnly, "revision-0");
    expect(assessment.mathematical_subject_changed).toBe(false);
    expect(assessment.mathematical_check_reusable).toBe(true);
    expect(assessment.applicability_requires_reassessment).toBe(true);
    expect(assessment.changed_dependencies).toContain("source.synthetic");
  });

  test("missing backend fails closed without a functional answer", () => {
    expectCode(
      () =>
        runDecisionCase(openDecisionCase(CASE_BYTES), "revision-0", {
          engineRoot: join(tmpdir(), "writ-engine-does-not-exist"),
        }),
      "DECISION_CASE_ENGINE_UNAVAILABLE",
    );
  });
});

const engineRoot = process.env.WRIT_DECISION_LAB_ROOT;
const pythonExecutable = process.env.WRIT_DECISION_LAB_PYTHON;
const integration = engineRoot !== undefined && pythonExecutable !== undefined ? test : test.skip;

describe("pinned Decision Lab integration", () => {
  integration(
    "checks exact outcomes, stale reuse, forged evidence, and relocated consumption",
    () => {
      const caseFile = openDecisionCase(CASE_BYTES);
      const options = { engineRoot: engineRoot!, pythonExecutable: pythonExecutable! };
      const executions = new Map(
        caseFile.value.analyses.map((analysis) => [
          analysis.analysis_id,
          runDecisionCase(caseFile, analysis.analysis_id, options),
        ]),
      );
      const expected = {
        "revision-0": ["uniformly_strictly_optimal", "-3/5", "8/5", "choose_a"],
        "revision-1": ["model_dependent", "3/2", "1", undefined],
        "revision-2": ["uniformly_strictly_optimal", "11/2", "-3", "choose_b"],
      } as const;
      for (const [id, [status, maximum, reverseMaximum, action]] of Object.entries(expected)) {
        const result = executions.get(id)!.mathematical_check.result;
        expect(result.status).toBe(status);
        const conclusion = result.conclusion as {
          pairwise_maxima: Array<[string, string, string]>;
          common_minimizers: string[];
        };
        expect(conclusion.pairwise_maxima[0]![2]).toBe(maximum);
        expect(conclusion.pairwise_maxima[1]![2]).toBe(reverseMaximum);
        expect(conclusion.common_minimizers[0]).toBe(action);
      }
      expect(
        executions.get("control-simultaneous-a-bounds")!.mathematical_check.result.status,
      ).toBe("incompatible");

      expectCode(
        () =>
          consumeDecision(
            caseFile,
            executions.get("revision-0")!,
            "revision-1",
            "static_expected_loss_decision",
            options,
          ),
        "DECISION_CASE_STALE_SUBJECT_BINDING",
      );
      expectCode(
        () =>
          consumeDecision(
            caseFile,
            executions.get("revision-0")!,
            "revision-0",
            "compatibility_check",
            options,
          ),
        "DECISION_CASE_UNSUPPORTED_USE",
      );

      for (const mutation of ["wrong-objective", "missing-certificate"] as const) {
        const forged = JSON.parse(
          new TextDecoder().decode(executionBytes(executions.get("revision-0")!)),
        ) as DecisionExecution;
        const candidate = JSON.parse(
          Buffer.from(forged.candidate_result.content, "base64").toString("utf8"),
        ) as {
          evidence: {
            pairs: Array<{
              maximum_difference: { objective: string; certificate?: unknown };
            }>;
          };
        };
        if (mutation === "wrong-objective") {
          candidate.evidence.pairs[0]!.maximum_difference.objective = "999";
        } else {
          delete candidate.evidence.pairs[0]!.maximum_difference.certificate;
        }
        (
          forged as unknown as { candidate_result: ReturnType<typeof encodedBytes> }
        ).candidate_result = encodedBytes(exactJsonBytes(candidate));
        expectCode(
          () =>
            consumeDecision(
              caseFile,
              forged,
              "revision-0",
              "static_expected_loss_decision",
              options,
            ),
          "DECISION_CASE_ENGINE_PROTOCOL_ERROR",
        );
      }

      const relocated = mkdtempSync(join(tmpdir(), "writ-recipient-"));
      const relocatedCase = join(relocated, "case.json");
      const relocatedExecution = join(relocated, "execution.json");
      writeFileSync(relocatedCase, exportDecisionCase(caseFile));
      writeFileSync(relocatedExecution, executionBytes(executions.get("revision-1")!));
      const cli = join(ROOT, "packages", "decision-case", "bin", "writ-decision-case.ts");
      const consumed = Bun.spawnSync(
        [
          process.execPath,
          cli,
          "consume",
          "--case",
          relocatedCase,
          "--execution",
          relocatedExecution,
          "--analysis",
          "revision-1",
          "--use",
          "static_expected_loss_decision",
          "--engine-root",
          engineRoot!,
          "--python",
          pythonExecutable!,
        ],
        { cwd: relocated, stdout: "pipe", stderr: "pipe" },
      );
      expect(consumed.exitCode).toBe(0);
      expect(new TextDecoder().decode(consumed.stdout)).toContain(
        '"mathematical_status": "model_dependent"',
      );
      expect(new TextDecoder().decode(consumed.stdout)).toContain('"human_review": {');

      const parsed = parseExecution(executionBytes(executions.get("revision-2")!));
      expect(Object.isFrozen(parsed)).toBe(true);
      expect(() => {
        (parsed as unknown as { analysis_id: string }).analysis_id = "revision-0";
      }).toThrow();
    },
  );
});
