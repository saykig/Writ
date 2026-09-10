import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  executionBytes,
  openDecisionCase,
  runDecisionCase,
} from "../../../packages/decision-case/src/index.js";
import {
  attachDecisionExecution,
  exportSharedAnalysis,
  importSharedAnalyses,
  recordRevision,
  replaySharedAnalysis,
  assessRevision,
} from "../../../packages/shared-analysis/src/index.js";
import {
  alphaImport,
  betaImport,
  sourceOnlyRevision,
  quantitativeRevision,
} from "../../../packages/shared-analysis/test/fixtures.js";

const { values } = parseArgs({
  options: {
    "engine-root": { type: "string" },
    python: { type: "string" },
    out: { type: "string" },
  },
});
if (!values["engine-root"] || !values.python || !values.out)
  throw new Error("engine-root, python, out required");
const options = { engineRoot: values["engine-root"], pythonExecutable: values.python };
mkdirSync(values.out, { recursive: true });
const put = (name: string, bytes: string | Uint8Array) =>
  writeFileSync(join(values.out!, name), bytes, { flag: "wx" });
let work = importSharedAnalyses("writ-vela-synthetic-reuse", [alphaImport, betaImport]);
for (const bundle of [alphaImport, betaImport]) {
  const execution = runDecisionCase(openDecisionCase(bundle.case_bytes), "analysis-base", options);
  work = attachDecisionExecution(
    work,
    { bundle_id: bundle.bundle_id, analysis_id: "analysis-base" },
    executionBytes(execution),
  );
  put(`${bundle.bundle_id}.case.json`, bundle.case_bytes);
  put(`${bundle.bundle_id}.execution.json`, executionBytes(execution));
}
put("stage-0.archive.json", exportSharedAnalysis(work));
for (const [index, event] of [sourceOnlyRevision(), quantitativeRevision()].entries()) {
  work = recordRevision(work, event);
  put(`stage-${index + 1}.archive.json`, exportSharedAnalysis(work));
  put(
    `stage-${index + 1}.impact.json`,
    JSON.stringify(assessRevision(work, event.revision_id), null, 2) + "\n",
  );
}
put(
  "recipient-replay.json",
  JSON.stringify(replaySharedAnalysis(exportSharedAnalysis(work), options), null, 2) + "\n",
);
console.log(
  JSON.stringify({
    workspace: work.value.workspace_id,
    revisions: work.value.revisions.length,
    freshly_checked: replaySharedAnalysis(exportSharedAnalysis(work), options).freshly_checked
      .length,
  }),
);
