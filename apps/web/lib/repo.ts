/**
 * Frozen-data readers for the server side of the site.
 *
 * The pilot methodologies, snapshots, and provenance are inlined at
 * build time into `frozen-data.ts` (see `scripts/embed-frozen.ts`) and served
 * from there. This is deliberate: the @writ/* packages locate their data via
 * `import.meta.url`, which bundlers rewrite to a build-time path, and Vercel does
 * not ship the repo data dirs into the serverless lambda (its root is
 * `/var/task`). Reading from the inlined map removes both failure modes. A
 * filesystem fallback keeps ad-hoc local reads working when a path is not inlined.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { FROZEN_FILES } from "./frozen-data.js";

let cached: string | undefined;

export function repoRoot(): string {
  if (cached) return cached;
  let dir = process.cwd();
  for (let i = 0; i < 10; i += 1) {
    if (
      existsSync(join(dir, "schemas")) &&
      existsSync(join(dir, "protocols")) &&
      existsSync(join(dir, "pilot", "eu-us-ai-evaluation"))
    ) {
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

export function readRepoText(rel: string): string {
  const inlined = FROZEN_FILES[rel];
  if (inlined !== undefined) return inlined;
  return readFileSync(join(repoRoot(), rel), "utf8");
}

export function readRepoJson<T>(rel: string): T {
  return JSON.parse(readRepoText(rel)) as T;
}

export function listRepoDir(rel: string): string[] {
  const prefix = rel.endsWith("/") ? rel : `${rel}/`;
  const inlined = Object.keys(FROZEN_FILES)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length).split("/")[0]);
  if (inlined.length > 0) return [...new Set(inlined)];
  return readdirSync(join(repoRoot(), rel));
}

export function repoFileExists(rel: string): boolean {
  return rel in FROZEN_FILES || existsSync(join(repoRoot(), rel));
}
