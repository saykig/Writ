// Shared helpers for the repositories layer.
import type { DbClient, TransactionSql } from "../client.js";

export type { DbClient };

/** A handle usable inside a transaction callback as well as at top level. */
export type Queryable = DbClient | TransactionSql;

/** Return the single row, or throw if the result set was empty. */
export function one<T>(rows: readonly T[], what: string): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`expected exactly one ${what} row, got none`);
  }
  return row;
}

/** Return the first row or null. */
export function maybe<T>(rows: readonly T[]): T | null {
  return rows[0] ?? null;
}

/** Wrap a value as a jsonb parameter without fighting the driver's JSONValue type. */
export function json(client: Queryable, value: unknown) {
  return client.json(value as never);
}

interface Beginner<T> {
  begin(cb: (tx: Queryable) => Promise<T>): Promise<T>;
}

/**
 * Run `fn` in a transaction. The pooled client exposes `.begin`; a reserved
 * connection (used by hermetic temp-schema tests) does not, so fall back to a
 * manual BEGIN/COMMIT on that single dedicated connection.
 */
export async function withTransaction<T>(
  client: DbClient,
  fn: (tx: Queryable) => Promise<T>,
): Promise<T> {
  // A reserved single connection (temp-schema tests) exposes `.release`. Its
  // `.begin` reuses the one physical connection and self-deadlocks when the
  // callback issues queries, so drive a manual BEGIN/COMMIT on it. The pool has
  // no `.release`; it MUST use `.begin` (a raw BEGIN would scatter across
  // pooled connections and never wrap the callback's queries).
  const isReserved = typeof (client as { release?: unknown }).release === "function";
  if (!isReserved && typeof (client as Partial<Beginner<T>>).begin === "function") {
    return (client as Beginner<T>).begin(fn);
  }
  await client`BEGIN`;
  try {
    const result = await fn(client);
    await client`COMMIT`;
    return result;
  } catch (err) {
    await client`ROLLBACK`;
    throw err;
  }
}
