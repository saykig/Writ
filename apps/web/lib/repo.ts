/**
 * Repo-root resolution + file readers for the server side of the site.
 *
 * The @covenant/* packages locate their data via `import.meta.url`, which is
 * rewritten by the Next bundler and would break at runtime. Instead we resolve
 * the repository root from `process.cwd()` (stable in `next dev` and on Vercel,
 * where cwd is the app root) by walking up to the directory that holds both
 * `examples/` and `benchmark/2025-ai-sme/`, and read the frozen files directly.
 * `next.config.ts` traces these paths into the serverless bundle.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

let cached: string | undefined;

export function repoRoot(): string {
  if (cached) return cached;
  let dir = process.cwd();
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "examples")) && existsSync(join(dir, "benchmark", "2025-ai-sme"))) {
      cached = dir;
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  cached = resolve(process.cwd(), "..", "..");
  return cached;
}

export const BENCH_DIR = "benchmark/2025-ai-sme";

export function readRepoText(rel: string): string {
  return readFileSync(join(repoRoot(), rel), "utf8");
}

export function readRepoJson<T>(rel: string): T {
  return JSON.parse(readRepoText(rel)) as T;
}

export function listRepoDir(rel: string): string[] {
  return readdirSync(join(repoRoot(), rel));
}

export function repoFileExists(rel: string): boolean {
  return existsSync(join(repoRoot(), rel));
}
