// Deterministic ISO-8601 temporal comparison for the Covenant evaluator.
//
// Per 04_FORMAL_SEMANTICS.md §9: every temporal predicate compares normalized
// ISO instants; a date has no implicit local time; `overlaps` follows interval
// algebra. We deliberately do NOT use `Date.parse` — its timezone handling is
// environment-dependent and non-deterministic. Instead we parse the ISO fields
// ourselves and reduce every instant to an integer count of nanoseconds from a
// fixed epoch via the standard days-from-civil algorithm, then compare BigInts.
//
// Normalization rules (deterministic, no tz database):
//   - `Z` and explicit `+HH:MM` / `-HH:MM` offsets are converted to UTC.
//   - A datetime with no offset is interpreted as UTC (a documented, stable
//     choice — never a local-clock read).
//   - A date-only value (`YYYY-MM-DD`) has no time; it is normalized to the
//     start of that UTC day for point comparison, and carries a `dateOnly` flag
//     so callers can widen it to a whole-day interval when that matters.

const DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?)?$/;

const NS_PER_SECOND = 1_000_000_000n;
const NS_PER_MINUTE = 60n * NS_PER_SECOND;
const NS_PER_HOUR = 60n * NS_PER_MINUTE;
const NS_PER_DAY = 24n * NS_PER_HOUR;

/** A parsed instant: nanoseconds from the Unix epoch, plus the date-only flag. */
export interface Instant {
  readonly ns: bigint;
  readonly dateOnly: boolean;
}

/** A temporal interval over instants (half-open handling via inclusivity flags). */
export interface TemporalInterval {
  readonly start: Instant;
  readonly end: Instant;
}

/**
 * Days from the Unix epoch (1970-01-01) for a proleptic-Gregorian y/m/d, using
 * Howard Hinnant's `days_from_civil` algorithm. Pure integer arithmetic.
 */
function daysFromCivil(year: number, month: number, day: number): bigint {
  const y = BigInt(month <= 2 ? year - 1 : year);
  const m = BigInt(month);
  const d = BigInt(day);
  const era = (y >= 0n ? y : y - 399n) / 400n;
  const yoe = y - era * 400n; // [0, 399]
  const mp = (m + 9n) % 12n; // [0, 11], March = 0
  const doy = (153n * mp + 2n) / 5n + d - 1n; // [0, 365]
  const doe = yoe * 365n + yoe / 4n - yoe / 100n + doy; // [0, 146096]
  return era * 146097n + doe - 719468n;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const monthLength = lengths[month - 1];
  return monthLength !== undefined && day <= monthLength;
}

/**
 * Parse an ISO-8601 date or datetime into an {@link Instant}. Returns `null` for
 * malformed input or impossible calendar dates (never throws, never guesses a
 * local timezone).
 */
export function parseInstant(input: unknown): Instant | null {
  if (typeof input !== "string") return null;
  const match = DATETIME_PATTERN.exec(input.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s, frac, offset] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (!isValidYmd(year, month, day)) return null;

  const dateOnly = h === undefined;
  const hour = h === undefined ? 0 : Number(h);
  const minute = mi === undefined ? 0 : Number(mi);
  const second = s === undefined ? 0 : Number(s);
  if (hour > 23 || minute > 59 || second > 60) return null; // allow leap second 60

  let nanos = 0n;
  if (frac !== undefined) {
    nanos = BigInt(frac.padEnd(9, "0").slice(0, 9));
  }

  let offsetNs = 0n;
  if (offset !== undefined && offset !== "Z") {
    const sign = offset.startsWith("-") ? -1n : 1n;
    const oh = BigInt(offset.slice(1, 3));
    const om = BigInt(offset.slice(4, 6));
    offsetNs = sign * (oh * NS_PER_HOUR + om * NS_PER_MINUTE);
  }

  const dayNs = daysFromCivil(year, month, day) * NS_PER_DAY;
  const timeNs =
    BigInt(hour) * NS_PER_HOUR +
    BigInt(minute) * NS_PER_MINUTE +
    BigInt(second) * NS_PER_SECOND +
    nanos;
  // Convert local wall time to UTC by subtracting the offset.
  return { ns: dayNs + timeNs - offsetNs, dateOnly };
}

/** Three-way comparison of instants: -1, 0, 1. */
export function compareInstant(a: Instant, b: Instant): -1 | 0 | 1 {
  if (a.ns < b.ns) return -1;
  if (a.ns > b.ns) return 1;
  return 0;
}

/** The exclusive-end instant of a date-only day (start + 24h), else the instant. */
function endOfInstant(a: Instant): bigint {
  return a.dateOnly ? a.ns + NS_PER_DAY : a.ns;
}

/**
 * `before`: strictly earlier. For two instants, `a < b`. When either side is a
 * date-only value it is treated as the whole day, so a date is "before" another
 * instant only when the entire day precedes it.
 */
export function instantBefore(a: Instant, b: Instant): boolean {
  return endOfInstant(a) <= b.ns;
}

/** `after`: strictly later — the mirror of {@link instantBefore}. */
export function instantAfter(a: Instant, b: Instant): boolean {
  return a.ns >= endOfInstant(b);
}

/**
 * Interval overlap per interval algebra (§9): two intervals overlap when each
 * starts no later than the other ends. Date-only endpoints widen to whole days.
 */
export function intervalsOverlap(a: TemporalInterval, b: TemporalInterval): boolean {
  const aStart = a.start.ns;
  const aEnd = endOfInstant(a.end);
  const bStart = b.start.ns;
  const bEnd = endOfInstant(b.end);
  return aStart <= bEnd && bStart <= aEnd;
}
