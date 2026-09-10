#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { replayLinkedEpisodeRevision } from "../src/linked-episodes.js";
try {
  const [file, linkSha256, parentSha256, successorSha256, engineRoot, pythonExecutable, ...rest] =
    process.argv.slice(2);
  if (
    !file ||
    !linkSha256 ||
    !parentSha256 ||
    !successorSha256 ||
    !engineRoot ||
    !pythonExecutable ||
    rest.length
  )
    throw new Error(
      "Usage: writ-linked-episodes LINK EXPECTED_LINK EXPECTED_PARENT EXPECTED_SUCCESSOR ENGINE_ROOT PYTHON",
    );
  console.log(
    JSON.stringify(
      replayLinkedEpisodeRevision(
        readFileSync(file),
        { linkSha256, parentSha256, successorSha256 },
        { engineRoot, pythonExecutable },
      ),
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 2;
}
