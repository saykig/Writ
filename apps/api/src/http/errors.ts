// Typed command errors for the governed evidence API.
//
// Every command failure is one of these; the Fastify layer maps them to an HTTP
// status + a stable, machine-readable `code`. Nothing else leaks a 500: an
// uncaught error becomes a generic 500 with no internal detail (secrets and
// stack traces stay out of responses, per AGENTS.md).

/** A command failure carrying an HTTP status and a stable diagnostic code. */
export class CommandError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CommandError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** 400 — the request body/params are malformed or fail a domain contract. */
export class ValidationError extends CommandError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, "invalid_request", message, details);
    this.name = "ValidationError";
  }
}

/** 401 — no valid bearer identity was presented. */
export class UnauthorizedError extends CommandError {
  constructor(message = "authentication required") {
    super(401, "unauthorized", message);
    this.name = "UnauthorizedError";
  }
}

/** 403 — authenticated, but the actor's role or separation-of-duties forbids it. */
export class ForbiddenError extends CommandError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(403, code, message, details);
    this.name = "ForbiddenError";
  }
}

/** 404 — the referenced object does not exist. */
export class NotFoundError extends CommandError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(404, "not_found", message, details);
    this.name = "NotFoundError";
  }
}

/** 409 — an optimistic-concurrency (expected-version) or illegal-transition clash. */
export class ConflictError extends CommandError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(409, code, message, details);
    this.name = "ConflictError";
  }
}

/** Narrow an unknown thrown value to a {@link CommandError}. */
export function isCommandError(err: unknown): err is CommandError {
  return err instanceof CommandError;
}
