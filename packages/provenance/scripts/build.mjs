import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "../..");
rmSync(join(packageRoot, "dist"), { recursive: true, force: true });
execFileSync(join(workspaceRoot, "node_modules/.bin/tsc"), ["-p", "tsconfig.build.json"], {
  cwd: packageRoot,
  stdio: "inherit",
});
