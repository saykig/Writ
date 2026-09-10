import { readFileSync } from "node:fs";

import { replaySimulationDecisionRevision } from "../src/simulation-decision-revision.js";

const [
  file,
  revisionSha256,
  parentComparisonSha256,
  successorComparisonSha256,
  parentEpisodeSha256,
  successorEpisodeSha256,
  engineRoot,
  pythonExecutable,
] = process.argv.slice(2);

if (
  !file ||
  !revisionSha256 ||
  !parentComparisonSha256 ||
  !successorComparisonSha256 ||
  !parentEpisodeSha256 ||
  !successorEpisodeSha256 ||
  !engineRoot ||
  !pythonExecutable
) {
  console.error(
    "Usage: writ-simulation-decision REVISION REVISION_SHA256 PARENT_COMPARISON_SHA256 SUCCESSOR_COMPARISON_SHA256 PARENT_EPISODE_SHA256 SUCCESSOR_EPISODE_SHA256 ENGINE_ROOT PYTHON",
  );
  process.exit(2);
}

try {
  const receipt = replaySimulationDecisionRevision(
    readFileSync(file),
    {
      revisionSha256,
      parentComparisonSha256,
      successorComparisonSha256,
      parentEpisodeSha256,
      successorEpisodeSha256,
    },
    { engineRoot, pythonExecutable },
  );
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
