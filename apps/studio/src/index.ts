/**
 * `@covenant/studio` entry point.
 *
 * Covenant Studio: a landing page, a live methodology playground, and the
 * 2025 AI-for-SMEs benchmark, all served over one fixed port and backed by the
 * real Covenant packages. This module is the only one that binds a socket; the
 * request handler lives in `./server.ts` and is re-exported for tests.
 */

import { handleRequest } from "./server.js";

export { handleRequest } from "./server.js";

/** Fixed development port for the studio (also declared in `.claude/launch.json`). */
export const PORT = 4317;

if (import.meta.main) {
  const server = Bun.serve({
    port: PORT,
    fetch: handleRequest,
  });
  console.log(`Covenant Studio → http://localhost:${server.port}`);
}
