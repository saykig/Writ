import { describe, expect, test } from "bun:test";
import {
  compareInstant,
  instantAfter,
  instantBefore,
  intervalsOverlap,
  parseInstant,
  type Instant,
} from "../src/index.js";

function i(s: string): Instant {
  const parsed = parseInstant(s);
  if (parsed === null) throw new Error(`bad instant ${s}`);
  return parsed;
}

describe("parseInstant", () => {
  test("parses dates, datetimes, offsets, fractional seconds", () => {
    expect(parseInstant("2026-07-22")).not.toBeNull();
    expect(parseInstant("2026-07-22T13:45:00Z")).not.toBeNull();
    expect(parseInstant("2026-07-22T13:45:00.123456789+02:00")).not.toBeNull();
    expect(parseInstant("not-a-date")).toBeNull();
    expect(parseInstant("2026-13-01")).toBeNull(); // impossible month
    expect(parseInstant("2026-02-30")).toBeNull(); // impossible day
  });
});

describe("compareInstant — deterministic, offset-normalized (no Date.parse)", () => {
  test("same instant expressed in different offsets is equal", () => {
    // 12:00Z == 14:00+02:00.
    expect(compareInstant(i("2026-07-22T12:00:00Z"), i("2026-07-22T14:00:00+02:00"))).toBe(0);
  });

  test("offset is applied in the correct direction", () => {
    // 10:00-05:00 == 15:00Z, which is after 12:00Z.
    expect(compareInstant(i("2026-07-22T10:00:00-05:00"), i("2026-07-22T12:00:00Z"))).toBe(1);
  });

  test("orders across dates", () => {
    expect(compareInstant(i("2020-01-01"), i("2021-01-01"))).toBe(-1);
  });
});

describe("before / after with date-only whole-day semantics", () => {
  test("a date is before an instant only when the whole day precedes it", () => {
    expect(instantBefore(i("2026-07-21"), i("2026-07-22T00:00:00Z"))).toBe(true);
    // 2026-07-22 (whole day) is NOT before an instant inside that same day.
    expect(instantBefore(i("2026-07-22"), i("2026-07-22T12:00:00Z"))).toBe(false);
  });

  test("after mirrors before", () => {
    expect(instantAfter(i("2026-07-23"), i("2026-07-22T23:59:59Z"))).toBe(true);
    expect(instantAfter(i("2020-01-01T00:00:00Z"), i("2026-01-01"))).toBe(false);
  });
});

describe("interval overlap (interval algebra, §9)", () => {
  test("overlapping ranges", () => {
    expect(
      intervalsOverlap(
        { start: i("2026-01-01T00:00:00Z"), end: i("2026-06-01T00:00:00Z") },
        { start: i("2026-05-01T00:00:00Z"), end: i("2026-12-01T00:00:00Z") },
      ),
    ).toBe(true);
  });

  test("disjoint ranges do not overlap", () => {
    expect(
      intervalsOverlap(
        { start: i("2026-01-01T00:00:00Z"), end: i("2026-02-01T00:00:00Z") },
        { start: i("2026-03-01T00:00:00Z"), end: i("2026-04-01T00:00:00Z") },
      ),
    ).toBe(false);
  });
});
