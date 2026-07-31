/**
 * Frozen-evidence re-derivation runner. Prints one line per check and exits
 * non-zero on any divergence. The logic lives in `@writ/benchmark`
 * (`src/replicate.ts`); this thin wrapper imports it by relative path so the
 * workspace `@writ/*` dependencies resolve from the package.
 *
 * Run: `bun internal/tooling/scripts/replicate.ts`
 */
import { replicate } from "../../../packages/benchmark/src/replicate.js";

const checks = replicate();
let failed = 0;
for (const check of checks) {
  console.log(`${check.ok ? "ok  " : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  if (!check.ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} re-derivation checks passed.`);
if (failed > 0) process.exit(1);
