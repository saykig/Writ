// DATA-002 / DATA-003 — the Fastify command API.
//
// Every mutating route is a COMMAND: authenticate the bearer token, enforce
// idempotency (a repeated `Idempotency-Key` replays the stored response without
// re-running the command), invoke the command/service (which does RBAC,
// separation of duties, optimistic concurrency, the state transition, and the
// audit event), and map typed `CommandError`s to stable HTTP responses. No
// internal detail leaks: an unexpected throw becomes a bare 500.

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { DbClient } from "../db/client.js";
import {
  acceptAction,
  acceptClaim,
  contestAction,
  contestClaim,
  createAction,
  createClaim,
  rejectAction,
  rejectClaim,
  submitAction,
  submitClaim,
  supersedeAction,
  supersedeClaim,
  type CommandContext,
  type CommandResult,
} from "../commands/evidence.js";
import { exportSnapshot, freezeSnapshot, type FreezeInput } from "../services/snapshot.js";
import { authenticate, devTokenVerifier, type Actor, type TokenVerifier } from "./auth.js";
import { isCommandError } from "./errors.js";
import {
  idempotencyScope,
  InMemoryIdempotencyStore,
  type IdempotencyStore,
} from "./idempotency.js";

export interface BuildAppOptions {
  /** The database handle commands run against (pool, or a test's reserved connection). */
  readonly client: DbClient;
  /** Bearer-token verifier; defaults to the dev static-token verifier. */
  readonly verifier?: TokenVerifier;
  /** Idempotency store; defaults to an in-memory store for this instance. */
  readonly idempotencyStore?: IdempotencyStore;
  /** Enable Fastify's request logger. Off by default (quiet tests). */
  readonly logger?: boolean;
}

type Body = Record<string, unknown>;
type CommandBody = { status: number; body: unknown };

/** The command endpoints this app serves (for docs / discoverability). */
export const ENDPOINTS: readonly string[] = [
  "GET  /health",
  "POST /v1/claims",
  "POST /v1/claims/:id/submit",
  "POST /v1/claims/:id/accept",
  "POST /v1/claims/:id/reject",
  "POST /v1/claims/:id/contest",
  "POST /v1/claims/:id/supersede",
  "POST /v1/actions",
  "POST /v1/actions/:id/submit",
  "POST /v1/actions/:id/accept",
  "POST /v1/actions/:id/reject",
  "POST /v1/actions/:id/contest",
  "POST /v1/actions/:id/supersede",
  "POST /v1/snapshots/freeze",
  "GET  /v1/snapshots/:id/export",
];

function headerValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function bodyOf(request: FastifyRequest): Body {
  const raw = request.body;
  return raw !== null && typeof raw === "object" ? (raw as Body) : {};
}

function paramId(request: FastifyRequest): string {
  const params = request.params as { id?: string } | undefined;
  return params?.id ?? "";
}

/** Build the Fastify command API. Does not listen; callers call `.listen` or `.inject`. */
export function buildApp(options: BuildAppOptions): FastifyInstance {
  const verifier = options.verifier ?? devTokenVerifier();
  const store = options.idempotencyStore ?? new InMemoryIdempotencyStore();
  const app = Fastify({ logger: options.logger ?? false });

  function sendError(request: FastifyRequest, reply: FastifyReply, err: unknown): unknown {
    if (isCommandError(err)) {
      reply.code(err.status);
      return {
        error: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      };
    }
    request.log.error(err);
    reply.code(500);
    return { error: "internal_error", message: "internal error" };
  }

  /**
   * Run an authenticated command with idempotency. `run` returns the HTTP status
   * and body; a repeated idempotency key short-circuits to the stored response.
   */
  async function command(
    request: FastifyRequest,
    reply: FastifyReply,
    run: (actor: Actor) => Promise<CommandBody>,
  ): Promise<unknown> {
    try {
      const actor = await authenticate(verifier, request.headers.authorization);
      const key = headerValue(request.headers["idempotency-key"]);
      if (key !== undefined && key.trim() !== "") {
        const scoped = idempotencyScope(actor.id, key);
        const prior = await store.get(scoped);
        if (prior !== undefined) {
          reply.code(prior.status);
          return prior.body;
        }
        const result = await run(actor);
        await store.set(scoped, { status: result.status, body: result.body });
        reply.code(result.status);
        return result.body;
      }
      const result = await run(actor);
      reply.code(result.status);
      return result.body;
    } catch (err) {
      return sendError(request, reply, err);
    }
  }

  const ok = (result: CommandResult): CommandBody => ({ status: 200, body: result });
  const created = (result: CommandResult): CommandBody => ({ status: 201, body: result });

  const ctxFor = (actor: Actor): CommandContext => ({ client: options.client, actor });

  // --- Health (public) ------------------------------------------------------
  app.get("/health", async () => ({ status: "ok", service: "@writ/api" }));

  // --- Claim commands -------------------------------------------------------
  app.post("/v1/claims", (request, reply) =>
    command(request, reply, async (actor) =>
      created(await createClaim(ctxFor(actor), bodyOf(request))),
    ),
  );
  app.post("/v1/claims/:id/submit", (request, reply) =>
    command(request, reply, async (actor) =>
      ok(await submitClaim(ctxFor(actor), paramId(request), bodyOf(request))),
    ),
  );
  app.post("/v1/claims/:id/accept", (request, reply) =>
    command(request, reply, async (actor) =>
      ok(await acceptClaim(ctxFor(actor), paramId(request), bodyOf(request))),
    ),
  );
  app.post("/v1/claims/:id/reject", (request, reply) =>
    command(request, reply, async (actor) =>
      ok(await rejectClaim(ctxFor(actor), paramId(request), bodyOf(request))),
    ),
  );
  app.post("/v1/claims/:id/contest", (request, reply) =>
    command(request, reply, async (actor) =>
      ok(await contestClaim(ctxFor(actor), paramId(request), bodyOf(request))),
    ),
  );
  app.post("/v1/claims/:id/supersede", (request, reply) =>
    command(request, reply, async (actor) =>
      created(await supersedeClaim(ctxFor(actor), paramId(request), bodyOf(request))),
    ),
  );

  // --- Action commands ------------------------------------------------------
  app.post("/v1/actions", (request, reply) =>
    command(request, reply, async (actor) =>
      created(await createAction(ctxFor(actor), bodyOf(request))),
    ),
  );
  app.post("/v1/actions/:id/submit", (request, reply) =>
    command(request, reply, async (actor) =>
      ok(await submitAction(ctxFor(actor), paramId(request), bodyOf(request))),
    ),
  );
  app.post("/v1/actions/:id/accept", (request, reply) =>
    command(request, reply, async (actor) =>
      ok(await acceptAction(ctxFor(actor), paramId(request), bodyOf(request))),
    ),
  );
  app.post("/v1/actions/:id/reject", (request, reply) =>
    command(request, reply, async (actor) =>
      ok(await rejectAction(ctxFor(actor), paramId(request), bodyOf(request))),
    ),
  );
  app.post("/v1/actions/:id/contest", (request, reply) =>
    command(request, reply, async (actor) =>
      ok(await contestAction(ctxFor(actor), paramId(request), bodyOf(request))),
    ),
  );
  app.post("/v1/actions/:id/supersede", (request, reply) =>
    command(request, reply, async (actor) =>
      created(await supersedeAction(ctxFor(actor), paramId(request), bodyOf(request))),
    ),
  );

  // --- Snapshot freeze + export (DATA-003) ----------------------------------
  app.post("/v1/snapshots/freeze", (request, reply) =>
    command(request, reply, async (actor) => {
      const summary = await freezeSnapshot(
        options.client,
        actor,
        bodyOf(request) as unknown as FreezeInput,
      );
      return { status: 201, body: summary };
    }),
  );
  app.get("/v1/snapshots/:id/export", (request, reply) =>
    command(request, reply, async () => {
      const evidence = await exportSnapshot(options.client, paramId(request));
      return { status: 200, body: evidence };
    }),
  );

  return app;
}
