// Authentication seam for the command API.
//
// A `TokenVerifier` turns a bearer token into an `Actor` (identity + roles) or
// null. The dev/CI default is a static in-memory token map; a real OIDC/JWKS
// verifier is a later concern and drops in behind the same interface without
// touching the command or route layers. The verifier NEVER trusts request
// content for identity — only the presented bearer token.

import { UnauthorizedError } from "./errors.js";

/**
 * Coarse authorization roles. `model` actors may create candidate evidence but
 * never accept/publish (AGENTS.md invariant 4); `author` submits; `reviewer`
 * decides; `admin` may also freeze snapshots.
 */
export type Role = "author" | "reviewer" | "admin" | "model";

export const ROLES: readonly Role[] = ["author", "reviewer", "admin", "model"];

/** An authenticated principal: a stable id plus its granted roles. */
export interface Actor {
  readonly id: string;
  readonly roles: readonly Role[];
}

/** Pluggable bearer-token verifier. Implementations must be side-effect free. */
export interface TokenVerifier {
  /** Resolve a raw bearer token to an actor, or null if the token is unknown. */
  verify(token: string): Actor | null | Promise<Actor | null>;
}

/**
 * Static-token verifier for development and tests: an explicit token -> actor
 * map. No network, no wall-clock, no implicit trust.
 */
export class StaticTokenVerifier implements TokenVerifier {
  private readonly tokens: ReadonlyMap<string, Actor>;

  constructor(tokens: ReadonlyMap<string, Actor> | Record<string, Actor>) {
    this.tokens =
      tokens instanceof Map ? tokens : new Map(Object.entries(tokens as Record<string, Actor>));
  }

  verify(token: string): Actor | null {
    return this.tokens.get(token) ?? null;
  }
}

/**
 * Build a {@link StaticTokenVerifier} from `COVENANT_DEV_TOKENS`, a JSON object
 * of `{ "<token>": { "id": "...", "roles": ["reviewer"] } }`. When unset, a
 * single well-known admin token seeds a usable dev instance. This is the "dev
 * static-token mode" seam; production wires a real IdP verifier instead.
 */
export function devTokenVerifier(env: NodeJS.ProcessEnv = process.env): StaticTokenVerifier {
  const raw = env.COVENANT_DEV_TOKENS;
  if (raw !== undefined && raw.trim() !== "") {
    const parsed = JSON.parse(raw) as Record<string, Actor>;
    return new StaticTokenVerifier(parsed);
  }
  return new StaticTokenVerifier({
    "dev-admin-token": { id: "dev-admin", roles: ["admin"] },
  });
}

/** Extract the raw token from an `Authorization: Bearer <token>` header. */
export function bearerToken(headerValue: string | undefined): string | null {
  if (headerValue === undefined) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match?.[1]?.trim() ?? null;
}

/**
 * Resolve the actor for a request from its Authorization header. Throws
 * {@link UnauthorizedError} when the header is missing or the token is unknown.
 */
export async function authenticate(
  verifier: TokenVerifier,
  headerValue: string | undefined,
): Promise<Actor> {
  const token = bearerToken(headerValue);
  if (token === null) {
    throw new UnauthorizedError("missing bearer token");
  }
  const actor = await verifier.verify(token);
  if (actor === null) {
    throw new UnauthorizedError("invalid bearer token");
  }
  return actor;
}

/** True when the actor holds any of the given roles. */
export function hasAnyRole(actor: Actor, ...roles: Role[]): boolean {
  return actor.roles.some((role) => roles.includes(role));
}
