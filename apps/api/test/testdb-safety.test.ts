import { describe, expect, test } from "bun:test";
import { validateTestDatabaseUrl } from "./testdb.js";

describe("database test credential boundary", () => {
  test("accepts an explicitly configured local test database", () => {
    const url = "postgresql://postgres:test@localhost:5432/writ_test";
    expect(validateTestDatabaseUrl(url)).toBe(url);
  });

  // Single-developer setup: the one Neon database (owner role) is a valid target.
  // Data is protected by the per-suite disposable schema, not by the role.
  test.each(["neondb_owner", "service-admin", "postgres"])(
    "accepts the configured database with role %s",
    (role) => {
      const url = `postgresql://${role}:redacted@example.neon.tech/neondb?sslmode=require`;
      expect(validateTestDatabaseUrl(url)).toBe(url);
    },
  );

  test("rejects a non-postgres connection string", () => {
    expect(() => validateTestDatabaseUrl("https://example.com/db")).toThrow(
      "must be a postgres connection string",
    );
  });

  test("rejects a malformed connection string", () => {
    expect(() => validateTestDatabaseUrl("not a url")).toThrow();
  });
});
