#!/usr/bin/env bun
import { renderVerificationJson, renderVerificationText } from "./core/output.js";
import { verificationWorkspace } from "./core/workspace.js";
import { verifyWorkspace, type VerificationSelection } from "./verify.js";
import type { WritVerificationResult } from "./types.js";

const aliases: Record<string, VerificationSelection> = {
  all: "all",
  ontology: "ontology",
  interoperability: "interoperability",
  interop: "interoperability",
  provenance: "provenance",
  integrity: "integrity",
};

let selection: VerificationSelection = "all";
let root: string | undefined;
let format: "text" | "json" = "text";
const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--");
for (let index = 0; index < arguments_.length; index += 1) {
  const argument = arguments_[index]!;
  if (argument === "--root") {
    root = arguments_[++index];
    if (!root) {
      console.error("--root requires a filesystem/worktree path");
      process.exit(2);
    }
  } else if (argument === "--format") {
    const requested = arguments_[++index];
    if (requested !== "text" && requested !== "json") {
      console.error("--format must be text or json");
      process.exit(2);
    }
    format = requested;
  } else if (aliases[argument]) {
    selection = aliases[argument];
  } else {
    console.error(`Unknown verification argument: ${argument}`);
    process.exit(2);
  }
}

let result: WritVerificationResult;
try {
  result = verifyWorkspace(verificationWorkspace(root), selection);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
console.log(format === "json" ? renderVerificationJson(result) : renderVerificationText(result));
process.exit(result.passed ? 0 : 1);
