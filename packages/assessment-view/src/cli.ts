import { readFileSync, writeFileSync } from "node:fs";
import { sha256Bytes } from "@writ/provenance";
import { inspectSharedAnalyses, openSharedAnalysis } from "@writ/shared-analysis";
import { applyRequest, initialSnapshot, need, validateSnapshot } from "./contract.js";
import { receiveContinuation } from "./receive.js";
import { renderView } from "./view.js";
const here = new URL("../../../examples/assessments/revisable-pilot/", import.meta.url);
const read = (path: string | URL): unknown => JSON.parse(readFileSync(path, "utf8"));
function write(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
}
function main() {
  const [operation, ...args] = process.argv.slice(2);
  if (operation === "init" && args.length === 1) {
    const freeze = read(new URL("packets/FREEZE.json", here)) as { files: Record<string, string> };
    const packets = [0, 1, 2].map((i) => {
      const name = `stage-${i}.json`;
      const bytes = readFileSync(new URL("packets/" + name, here));
      need(sha256Bytes(bytes) === "sha256:" + freeze.files[name], "FROZEN_PACKET_CHANGED");
      return JSON.parse(bytes.toString());
    });
    write(args[0]!, initialSnapshot(packets));
  } else if (operation === "apply" && args.length === 3) {
    write(args[2]!, applyRequest(read(args[0]!), read(args[1]!)));
  } else if (operation === "receive" && args.length === 3) {
    console.log(
      JSON.stringify(receiveContinuation(read(args[0]!), read(args[1]!), read(args[2]!)), null, 2),
    );
  } else if (operation === "view" && args.length === 3) {
    const snapshot = read(args[0]!);
    validateSnapshot(snapshot);
    const bytes = readFileSync(args[1]!);
    const receipt = read(new URL("evidence/vela-reuse.json", here)) as {
      native_revision_replay: { archive_sha256: string };
    };
    need(
      sha256Bytes(bytes) === receipt.native_revision_replay.archive_sha256,
      "NATIVE_ARCHIVE_MISMATCH",
    );
    const inspection = inspectSharedAnalyses(openSharedAnalysis(bytes));
    writeFileSync(
      args[2]!,
      renderView(snapshot, {
        archive_base64: bytes.toString("base64"),
        archive_sha256: sha256Bytes(bytes),
        inspection,
        replay: receipt.native_revision_replay,
      }),
      { flag: "wx" },
    );
  } else
    throw new Error(
      "Usage: cli.ts init OUT | apply BASE REQUEST OUT | receive BASE REQUEST RESULT | view HISTORY NATIVE_ARCHIVE OUT.html",
    );
}
try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
