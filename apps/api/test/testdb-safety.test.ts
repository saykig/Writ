import { describe, expect, test } from "bun:test";
import { validateTestDatabaseUrl } from "./testdb.js";

describe("database test credential boundary", () => {
  test("accepts an explicitly configured local test database", () => {
    const url = "postgresql://postgres:test@localhost:5432/writ_test";
    expect(validateTestDatabaseUrl(url)).toBe(url);
  });

  test.each(["neondb_owner", "service-admin", "root", "postgres"])(
    "rejects remote privileged role %s",
    (role) => {
      expect(() =>
        validateTestDatabaseUrl(
          `postgresql://${role}:redacted@example.neon.tech/writ_test?sslmode=require`,
        ),
      ).toThrow("must not use a remote owner, admin, root, or postgres role");
    },
  );

  test("accepts a remote role explicitly named as restricted", () => {
    const url =
      "postgresql://writ_test_restricted:redacted@example.neon.tech/writ_test?sslmode=require";
    expect(validateTestDatabaseUrl(url)).toBe(url);
  });
});
