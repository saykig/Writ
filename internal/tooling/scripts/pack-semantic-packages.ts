import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..", "..");
const output = join(root, "dist", "packages");
const packages = ["domain", "provenance", "language", "evaluator", "analyzer"] as const;

mkdirSync(output, { recursive: true });
for (const name of packages) {
  const cwd = join(root, "packages", name);
  execFileSync("bun", ["run", "build"], { cwd, stdio: "inherit" });
  execFileSync("bun", ["pm", "pack", "--ignore-scripts", "--destination", output, "--quiet"], {
    cwd,
    stdio: "inherit",
  });
}

