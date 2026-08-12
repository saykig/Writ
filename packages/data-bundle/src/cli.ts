import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { generateWritDataBundle } from "./generate.js";
import { serializeBundle } from "./hashing.js";
import { repositoryRoot } from "./repository.js";
import { validateWritDataBundle } from "./validate.js";

export const defaultBundlePath = join(repositoryRoot, "dist/data/writ-data-bundle.json");

function outputArgument(args: readonly string[]): string {
  const index = args.indexOf("--output");
  if (index === -1) return defaultBundlePath;
  const value = args[index + 1];
  if (!value) throw new Error("--output requires a path");
  return resolve(repositoryRoot, value);
}

export function exportBundle(path = defaultBundlePath): void {
  const bundle = generateWritDataBundle();
  validateWritDataBundle(bundle);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeBundle(bundle));
  console.log(
    `data:export: wrote ${path} (${bundle.records.length} records, ${bundle.metadata.bundleHash})`,
  );
}

export function checkBundle(): void {
  const temporary = mkdtempSync(join(tmpdir(), "writ-data-bundle-"));
  try {
    const first = generateWritDataBundle();
    const second = generateWritDataBundle();
    validateWritDataBundle(first);
    validateWritDataBundle(second);
    const firstPath = join(temporary, "first.json");
    const secondPath = join(temporary, "second.json");
    writeFileSync(firstPath, serializeBundle(first));
    writeFileSync(secondPath, serializeBundle(second));
    if (readFileSync(firstPath, "utf8") !== readFileSync(secondPath, "utf8")) {
      throw new Error("Two clean exports are not byte-identical");
    }
    console.log(
      `data:check: ${first.records.length} records, ${first.recordLinks.length} links, ${first.recordJudgments.length} judgments; byte-identical; ${first.metadata.bundleHash}`,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const [command, ...args] = Bun.argv.slice(2);
  if (command === "export") exportBundle(outputArgument(args));
  else if (command === "check") checkBundle();
  else throw new Error("Usage: cli.ts <export|check> [--output path]");
}
