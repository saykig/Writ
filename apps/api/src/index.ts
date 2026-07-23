// Application entry point for @covenant/api.
//
// The evidence-ledger database layer (schema/migrations DATA-001 and the source
// registry service DATA-004) plus the governed command API (DATA-002) and the
// snapshot freeze/export service (DATA-003) built on the repositories.
export * from "./db/index.js";

// HTTP command API + auth/idempotency seams.
export * from "./http/errors.js";
export * from "./http/auth.js";
export * from "./http/idempotency.js";
export { buildApp, ENDPOINTS, type BuildAppOptions } from "./http/app.js";

// Commands + snapshot service (reusable outside HTTP).
export * from "./commands/audit.js";
export * from "./commands/evidence.js";
export {
  buildEvidenceSnapshot,
  exportSnapshot,
  freezeSnapshot,
  type BuildParams,
  type BuiltSnapshot,
  type FreezeInput,
  type FreezeSummary,
} from "./services/snapshot.js";

// Runnable server: `bun run apps/api/src/index.ts` (from repo root so .env loads).
if (typeof import.meta.main === "boolean" && import.meta.main) {
  const { getSql } = await import("./db/client.js");
  const { buildApp } = await import("./http/app.js");
  const app = buildApp({ client: getSql(), logger: true });
  const port = Number(process.env.PORT ?? 4318);
  await app.listen({ port, host: "0.0.0.0" });
}
