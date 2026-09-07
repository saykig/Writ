import { describe, expect, test } from "bun:test";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256Bytes } from "@writ/provenance";
import _Ajv2020 from "ajv/dist/2020.js";

import {
  assessReuse,
  consumeDecision,
  DecisionCaseError,
  encodedBytes,
  exactJsonBytes,
  exactJsonKey,
  executionBytes,
  exportDecisionCase,
  openDecisionCase,
  parseExecution,
  runDecisionCase,
  type DecisionCase,
  type DecisionExecution,
} from "../src/index.js";
import {
  createVerifiedEngineSourceSnapshot,
  PINNED_ENGINE_SOURCE_PATHS,
  VERIFIED_ENGINE_SNAPSHOT_PREFIX,
} from "../src/verified-engine-source.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CASE_PATH = join(
  ROOT,
  "examples",
  "decision-cases",
  "failure-choice",
  "case.json",
);
const CASE_BYTES = readFileSync(CASE_PATH);
type DefaultExport<T> = T extends { default: infer D } ? D : T;
const Ajv2020 = ((_Ajv2020 as { default?: unknown }).default ?? _Ajv2020) as DefaultExport<
  typeof _Ajv2020
>;

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

function relativeTree(root: string): string[] {
  const entries: string[] = [];
  const visit = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const relative = prefix.length === 0 ? entry.name : posix.join(prefix, entry.name);
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        entries.push(`directory:${relative}`);
        visit(absolute, relative);
      } else {
        entries.push(`file:${relative}:${sha256Bytes(readFileSync(absolute))}`);
      }
    }
  };
  visit(root, "");
  return entries.sort();
}

function activeVerifiedSourceSnapshots(): string[] {
  return readdirSync(tmpdir())
    .filter((name) => name.startsWith(VERIFIED_ENGINE_SNAPSHOT_PREFIX))
    .sort();
}

describe("portable decision case", () => {
  test("the authoritative schemas accept the portable case and execution artifacts", () => {
    const ajv = new Ajv2020({ strict: true, allowUnionTypes: true });
    const caseSchema = JSON.parse(
      readFileSync(join(ROOT, "schemas", "analysis", "decision-case-v0.1.schema.json"), "utf8"),
    );
    const executionSchema = JSON.parse(
      readFileSync(
        join(ROOT, "schemas", "analysis", "decision-execution-v0.1.schema.json"),
        "utf8",
      ),
    );
    const validateCase = ajv.compile(caseSchema);
    const validateExecution = ajv.compile(executionSchema);
    expect(validateCase(JSON.parse(new TextDecoder().decode(CASE_BYTES)))).toBe(true);
    for (const name of [
      "revision-0",
      "revision-1",
      "revision-2",
      "control-simultaneous-a-bounds",
    ]) {
      const artifact = JSON.parse(
        readFileSync(
          join(
            ROOT,
            "examples",
            "decision-cases",
            "failure-choice",
            "executions",
            `${name}.execution.json`,
          ),
          "utf8",
        ),
      );
      expect(validateExecution(artifact)).toBe(true);
    }
  });

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

  test("malformed runtime shapes return stable typed errors", () => {
    expectCode(
      () => openDecisionCase(exactJsonBytes({ schema_version: "0.1.0" })),
      "DECISION_CASE_INVALID",
    );
    expectCode(
      () => parseExecution(exactJsonBytes({ schema_version: "0.1.0" })),
      "DECISION_CASE_INVALID",
    );

    const execution = JSON.parse(
      readFileSync(
        join(
          ROOT,
          "examples",
          "decision-cases",
          "failure-choice",
          "executions",
          "revision-0.execution.json",
        ),
        "utf8",
      ),
    ) as DecisionExecution;
    (execution as unknown as { candidate_result: { encoding: string } }).candidate_result.encoding =
      "hex";
    expectCode(() => parseExecution(exactJsonBytes(execution)), "DECISION_CASE_INVALID");
  });

  test("enforces the complete authoritative case schema at the public loader", () => {
    const mutations: Array<(value: DecisionCase) => void> = [
      (value) => {
        delete (value.analyses[0] as unknown as { kind?: string }).kind;
      },
      (value) => {
        delete (value.analyses[0] as unknown as { prohibited_uses?: string[] }).prohibited_uses;
      },
      (value) => {
        (value.analyses[0] as unknown as { human_review: unknown }).human_review = {
          disposition: "accepted",
          reviewer: 7,
        };
      },
      (value) => {
        (value.analyses[0] as unknown as { human_review: unknown }).human_review = {
          disposition: "invented_status",
          reviewer: null,
        };
      },
      (value) => {
        (value as unknown as { undeclared: boolean }).undeclared = true;
      },
      (value) => {
        (value.source_references[0] as unknown as { byte_span: unknown }).byte_span = null;
      },
      (value) => {
        (value as unknown as { source_documents: unknown }).source_documents = null;
      },
    ];
    for (const mutate of mutations) {
      const value = mutableCase();
      mutate(value);
      expectCode(() => reopen(value), "DECISION_CASE_INVALID");
    }

    const text = readFileSync(CASE_PATH, "utf8");
    const duplicateKey = new TextEncoder().encode(`{"case\\u005fid":"duplicate",${text.slice(1)}`);
    expectCode(() => openDecisionCase(duplicateKey), "DECISION_CASE_INVALID");
    const tooDeep = new TextEncoder().encode(`${"[".repeat(65)}null${"]".repeat(65)}`);
    expectCode(() => openDecisionCase(tooDeep), "DECISION_CASE_INVALID");
    expectCode(
      () => openDecisionCase(new Uint8Array(8 * 1024 * 1024 + 1)),
      "DECISION_CASE_INVALID",
    );
  });

  test("enforces the complete execution schema at the public parser", () => {
    const executionPath = join(
      ROOT,
      "examples",
      "decision-cases",
      "failure-choice",
      "executions",
      "revision-0.execution.json",
    );
    const valid = JSON.parse(readFileSync(executionPath, "utf8")) as DecisionExecution;
    expect(parseExecution(exactJsonBytes(valid)).analysis_id).toBe("revision-0");
    const mutations: Array<(value: DecisionExecution) => void> = [
      (value) => {
        delete (value as unknown as { engine?: unknown }).engine;
      },
      (value) => {
        (value as unknown as { human_review: unknown }).human_review = {
          disposition: "accepted",
          reviewer: 7,
        };
      },
      (value) => {
        (value as unknown as { human_review: unknown }).human_review = {
          disposition: "proposed",
          reviewer: "not-an-authentication-claim",
        };
      },
      (value) => {
        (value as unknown as { undeclared: boolean }).undeclared = true;
      },
      (value) => {
        (value.mathematical_check.result as unknown as { status: string }).status =
          "invented_status";
      },
      (value) => {
        delete (value.mathematical_check as unknown as { result?: unknown }).result;
      },
    ];
    for (const mutate of mutations) {
      const value = JSON.parse(readFileSync(executionPath, "utf8")) as DecisionExecution;
      mutate(value);
      expectCode(() => parseExecution(exactJsonBytes(value)), "DECISION_CASE_INVALID");
    }
  });

  test("compares mappings and semantic context with collision-free structured identities", () => {
    expect(exactJsonKey(["a\u0000b", "c"])).not.toBe(exactJsonKey(["a", "b\u0000c"]));
    const base = openDecisionCase(CASE_BYTES);
    const unchanged = assessReuse(base, "revision-0", base, "revision-0");
    expect(unchanged).toMatchObject({
      mathematical_subject_changed: false,
      applicability_changed: false,
      changed_dependencies: [],
      changed_mappings: [],
      changed_context_fields: [],
      human_review_changed: false,
      mathematical_check_reusable: true,
      applicability_requires_reassessment: false,
    });

    const mappingValue = mutableCase();
    const mapping = mappingValue.analyses[0]!.model_mappings.find(({ target }) =>
      target.startsWith("query.action:"),
    )! as unknown as { target: string; dependency_ids: string[] };
    mapping.dependency_ids = ["source.synthetic"];
    const mappingAssessment = assessReuse(base, "revision-0", reopen(mappingValue), "revision-0");
    expect(mappingAssessment.mathematical_check_reusable).toBe(true);
    expect(mappingAssessment.applicability_changed).toBe(true);
    expect(mappingAssessment.applicability_requires_reassessment).toBe(true);
    expect(mappingAssessment.changed_mappings).toEqual([mapping.target]);

    const oldCollision = mutableCase();
    const nextCollision = mutableCase();
    const oldDependency = oldCollision.analyses[0]!.dependencies[0]! as unknown as {
      description: string;
      rationale: string;
    };
    const nextDependency = nextCollision.analyses[0]!.dependencies[0]! as unknown as {
      description: string;
      rationale: string;
    };
    oldDependency.description = "a\u0001b";
    oldDependency.rationale = "c";
    nextDependency.description = "a";
    nextDependency.rationale = "b\u0001c";
    const collisionAssessment = assessReuse(
      reopen(oldCollision),
      "revision-0",
      reopen(nextCollision),
      "revision-0",
    );
    expect(collisionAssessment.applicability_changed).toBe(true);
    expect(collisionAssessment.changed_dependencies).toContain("source.synthetic");

    const unitValue = mutableCase();
    (unitValue.analyses[0] as unknown as { unit: string }).unit = "other fictional unit";
    const unitAssessment = assessReuse(base, "revision-0", reopen(unitValue), "revision-0");
    expect(unitAssessment.mathematical_check_reusable).toBe(true);
    expect(unitAssessment.applicability_requires_reassessment).toBe(true);
    expect(unitAssessment.changed_context_fields).toContain("unit");

    const titleValue = mutableCase();
    (titleValue as unknown as { title: string }).title = "Unrelated display title";
    expect(assessReuse(base, "revision-0", reopen(titleValue), "revision-0")).toMatchObject({
      applicability_changed: false,
      human_review_changed: false,
      mathematical_check_reusable: true,
    });

    const reviewValue = mutableCase();
    (reviewValue.analyses[0] as unknown as { human_review: unknown }).human_review = {
      disposition: "proposed",
      reviewer: null,
    };
    expect(assessReuse(base, "revision-0", reopen(reviewValue), "revision-0")).toMatchObject({
      applicability_changed: false,
      human_review_changed: true,
      mathematical_check_reusable: true,
    });
  });
});

const engineRoot = process.env.WRIT_DECISION_LAB_ROOT;
const pythonExecutable = process.env.WRIT_DECISION_LAB_PYTHON;
const integrationRequired = process.env.WRIT_REQUIRE_DECISION_LAB_INTEGRATION === "1";
if (integrationRequired && (engineRoot === undefined || pythonExecutable === undefined)) {
  throw new Error(
    "Decision Lab integration prerequisites are required: set WRIT_DECISION_LAB_ROOT and WRIT_DECISION_LAB_PYTHON.",
  );
}
const integration = engineRoot !== undefined && pythonExecutable !== undefined ? test : test.skip;

describe("pinned Decision Lab integration", () => {
  integration("executes only a temporary snapshot of the verified source bytes", () => {
    const caseFile = openDecisionCase(CASE_BYTES);
    const artifactRoot = mkdtempSync(join(tmpdir(), "writ-engine-artifacts-"));
    try {
      cpSync(join(engineRoot!, "src"), join(artifactRoot, "src"), { recursive: true });
      const packageRoot = join(artifactRoot, "src", "writ_decision_lab");
      rmSync(join(packageRoot, "__pycache__"), { recursive: true, force: true });
      rmSync(join(packageRoot, "build2", "__pycache__"), { recursive: true, force: true });
      mkdirSync(join(packageRoot, "__pycache__"), { recursive: true });
      mkdirSync(join(packageRoot, "build2", "__pycache__"), { recursive: true });
      writeFileSync(join(packageRoot, "__pycache__", "unused.cpython-313.pyc"), "inert\n");
      writeFileSync(join(packageRoot, "unrelated.py"), "UNUSED = True\n");
      writeFileSync(join(packageRoot, "unrelated.cache"), "inert\n");
      const externalTree = relativeTree(artifactRoot);

      const inspectedSnapshot = createVerifiedEngineSourceSnapshot(artifactRoot);
      const inspectedRoot = inspectedSnapshot.root;
      try {
        const stagedTree = relativeTree(inspectedRoot);
        const stagedFiles = stagedTree.filter((entry) => entry.startsWith("file:"));
        const expectedFiles = PINNED_ENGINE_SOURCE_PATHS.map(
          (relative) =>
            `file:${relative}:${sha256Bytes(readFileSync(join(artifactRoot, relative)))}`,
        ).sort();
        expect(stagedFiles).toEqual(expectedFiles);
        expect(stagedTree.filter((entry) => entry.startsWith("directory:"))).toEqual([
          "directory:src",
          "directory:src/writ_decision_lab",
          "directory:src/writ_decision_lab/build2",
        ]);
        expect(stagedTree.some((entry) => entry.includes("__pycache__"))).toBe(false);
        expect(stagedTree.some((entry) => entry.includes("unrelated"))).toBe(false);
      } finally {
        inspectedSnapshot.dispose();
      }
      expect(existsSync(inspectedRoot)).toBe(false);

      const snapshotsBeforeSuccess = activeVerifiedSourceSnapshots();
      const execution = runDecisionCase(caseFile, "revision-0", {
        engineRoot: artifactRoot,
        pythonExecutable: pythonExecutable!,
      });
      expect(execution.mathematical_check.result.status).toBe("uniformly_strictly_optimal");
      expect(activeVerifiedSourceSnapshots()).toEqual(snapshotsBeforeSuccess);
      expect(relativeTree(artifactRoot)).toEqual(externalTree);

      const unsupportedRuntime = Bun.spawnSync(
        [
          "/usr/bin/python3",
          "-I",
          "-c",
          "import platform,sys;print(f'{platform.python_implementation()}:{sys.version_info.major}.{sys.version_info.minor}')",
        ],
        { stdout: "pipe", stderr: "pipe" },
      );
      expect(unsupportedRuntime.exitCode).toBe(0);
      expect(new TextDecoder().decode(unsupportedRuntime.stdout).trim()).not.toBe("CPython:3.13");
      const snapshotsBeforeFailure = activeVerifiedSourceSnapshots();
      try {
        runDecisionCase(caseFile, "revision-0", {
          engineRoot: artifactRoot,
          pythonExecutable: "/usr/bin/python3",
        });
        throw new Error("Expected unsupported Python runtime rejection.");
      } catch (error) {
        expect(error).toBeInstanceOf(DecisionCaseError);
        expect((error as DecisionCaseError).code).toBe("DECISION_CASE_ENGINE_UNAVAILABLE");
        expect((error as Error).message).toContain("unsupported_python_runtime:");
      }
      expect(activeVerifiedSourceSnapshots()).toEqual(snapshotsBeforeFailure);
      expect(relativeTree(artifactRoot)).toEqual(externalTree);
    } finally {
      rmSync(artifactRoot, { recursive: true, force: true });
    }
  });

  integration(
    "checks exact outcomes, stale reuse, forged evidence, and relocated consumption",
    () => {
      const caseFile = openDecisionCase(CASE_BYTES);
      const options = { engineRoot: engineRoot!, pythonExecutable: pythonExecutable! };
      const runtime = Bun.spawnSync(
        [
          pythonExecutable!,
          "-I",
          "-c",
          "import platform,sys;print(f'{platform.python_implementation()} {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')",
        ],
        { stdout: "pipe", stderr: "pipe" },
      );
      expect(runtime.exitCode).toBe(0);
      expect(new TextDecoder().decode(runtime.stdout).trim()).toMatch(/^CPython 3\.13\.[0-9]+$/);
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

      const unrelatedValue = mutableCase();
      (unrelatedValue as unknown as { title: string }).title = "Changed unrelated display title";
      const unrelatedCase = reopen(unrelatedValue);
      expect(
        consumeDecision(
          unrelatedCase,
          executions.get("revision-0")!,
          "revision-0",
          "static_expected_loss_decision",
          options,
        ).mathematical_status,
      ).toBe("uniformly_strictly_optimal");

      const changedChoiceValue = mutableCase();
      const changedChoice = changedChoiceValue.analyses[0]!.dependencies.find(
        ({ dependency_id }) => dependency_id === "choice.unrestricted-dependence",
      )! as unknown as { rationale: string };
      changedChoice.rationale = "Changed modelling rationale requiring explicit reassessment.";
      expectCode(
        () =>
          consumeDecision(
            reopen(changedChoiceValue),
            executions.get("revision-0")!,
            "revision-0",
            "static_expected_loss_decision",
            options,
          ),
        "DECISION_CASE_APPLICABILITY_REASSESSMENT_REQUIRED",
      );

      const changedMappingValue = mutableCase();
      const changedMapping = changedMappingValue.analyses[0]!.model_mappings.find(({ target }) =>
        target.startsWith("query.action:"),
      )! as unknown as { dependency_ids: string[] };
      changedMapping.dependency_ids = ["source.synthetic"];
      expectCode(
        () =>
          consumeDecision(
            reopen(changedMappingValue),
            executions.get("revision-0")!,
            "revision-0",
            "static_expected_loss_decision",
            options,
          ),
        "DECISION_CASE_APPLICABILITY_REASSESSMENT_REQUIRED",
      );

      const changedUnitValue = mutableCase();
      (changedUnitValue.analyses[0] as unknown as { unit: string }).unit = "other fictional unit";
      expectCode(
        () =>
          consumeDecision(
            reopen(changedUnitValue),
            executions.get("revision-0")!,
            "revision-0",
            "static_expected_loss_decision",
            options,
          ),
        "DECISION_CASE_APPLICABILITY_REASSESSMENT_REQUIRED",
      );

      const changedReviewValue = mutableCase();
      (changedReviewValue.analyses[0] as unknown as { human_review: unknown }).human_review = {
        disposition: "proposed",
        reviewer: null,
      };
      expect(
        consumeDecision(
          reopen(changedReviewValue),
          executions.get("revision-0")!,
          "revision-0",
          "static_expected_loss_decision",
          options,
        ).human_review.disposition,
      ).toBe("proposed");

      const unresolved = JSON.parse(
        new TextDecoder().decode(executionBytes(executions.get("revision-0")!)),
      ) as DecisionExecution;
      const unresolvedCandidate = exactJsonBytes({
        schema: "finite-linear-uncertainty-result.v1",
        operation: "decision",
        model_sha256: unresolved.problem_sha256.slice("sha256:".length),
        query_sha256: unresolved.query_sha256.slice("sha256:".length),
        family_kind: "exact_family",
        backend: "scipy-1.17.0-highs-candidate-search",
        status: "unresolved",
        reason: "absent_exact_action_certificate",
        evidence: {},
      });
      (
        unresolved as unknown as { candidate_result: ReturnType<typeof encodedBytes> }
      ).candidate_result = encodedBytes(unresolvedCandidate);
      const unresolvedUse = consumeDecision(
        caseFile,
        unresolved,
        "revision-0",
        "static_expected_loss_decision",
        options,
      );
      expect(unresolvedUse.functional).toBe(false);
      expect(unresolvedUse.mathematical_status).toBe("unresolved");
      expect(unresolvedUse.conclusion).toBeNull();

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
          "DECISION_CASE_MATHEMATICAL_CHECK_FAILED",
        );
      }

      const parentDriftRoot = mkdtempSync(join(tmpdir(), "writ-parent-drift-"));
      try {
        cpSync(join(engineRoot!, "src"), join(parentDriftRoot, "src"), { recursive: true });
        appendFileSync(
          join(parentDriftRoot, "src", "writ_decision_lab", "__init__.py"),
          "\n# harmless pin-drift marker\n",
          "utf8",
        );
        expectCode(
          () =>
            runDecisionCase(caseFile, "revision-0", {
              engineRoot: parentDriftRoot,
              pythonExecutable: pythonExecutable!,
            }),
          "DECISION_CASE_ENGINE_PIN_MISMATCH",
        );
      } finally {
        rmSync(parentDriftRoot, { recursive: true, force: true });
      }

      const build2DriftRoot = mkdtempSync(join(tmpdir(), "writ-build2-drift-"));
      try {
        cpSync(join(engineRoot!, "src"), join(build2DriftRoot, "src"), { recursive: true });
        appendFileSync(
          join(build2DriftRoot, "src", "writ_decision_lab", "build2", "checker.py"),
          "\n# harmless pin-drift marker\n",
          "utf8",
        );
        expectCode(
          () =>
            runDecisionCase(caseFile, "revision-0", {
              engineRoot: build2DriftRoot,
              pythonExecutable: pythonExecutable!,
            }),
          "DECISION_CASE_ENGINE_PIN_MISMATCH",
        );
      } finally {
        rmSync(build2DriftRoot, { recursive: true, force: true });
      }

      const relocated = mkdtempSync(join(tmpdir(), "writ-recipient-"));
      try {
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
      } finally {
        rmSync(relocated, { recursive: true, force: true });
      }

      const parsed = parseExecution(executionBytes(executions.get("revision-2")!));
      expect(Object.isFrozen(parsed)).toBe(true);
      expect(() => {
        (parsed as unknown as { analysis_id: string }).analysis_id = "revision-0";
      }).toThrow();
    },
  );
});
