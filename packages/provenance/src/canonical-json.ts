/**
 * Writ Canonical JSON v1.
 *
 * The profile derives whitespace-free serialization, JSON literal and string
 * escaping, finite ECMAScript number serialization, recursive UTF-16 property
 * ordering, preserved array order, and UTF-8 output from RFC 8785/JCS.
 *
 * Writ v1 additionally NFC-normalizes every string value and object key, and
 * may omit declared JSON-Pointer fields before serialization. RFC 8785 instead
 * requires parsed Unicode strings to remain unchanged and does not define this
 * field-omission transform. The complete Writ profile is therefore not RFC
 * 8785-conformant, even though it deliberately reuses JCS serialization rules.
 * Existing Writ hashes remain defined by this profile; changing these steps
 * would require a new profile and an explicit hash migration.
 *
 * The serializer operates on an in-memory JSON value (the result of
 * `JSON.parse` or an equivalent plain structure): `null`, boolean, number,
 * string, ordinary array, and plain object. Any other runtime type or object
 * (`undefined`, bigint, function, symbol, Date, Map, Set, RegExp, boxed
 * primitive, class instance, or custom-prototype object) is rejected with
 * {@link CanonicalJsonError}; `undefined`-valued object properties are omitted,
 * matching JSON semantics.
 */

/** Error thrown for any value that cannot be represented in canonical JSON. */
export class CanonicalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalJsonError";
  }
}

export interface CanonicalOptions {
  /**
   * Writ-specific fields to omit before canonicalizing (transport / volatile /
   * self-referential fields declared non-semantic). This transform is not part
   * of RFC 8785/JCS.
   *
   * Each entry is an RFC 6901 JSON Pointer, e.g. `"/signature"` or
   * `"/dependencies/methodology_bundle_hash"`. As a convenience, a bare token
   * without a leading `/` is treated as a top-level key, so `"signature"` is
   * equivalent to `"/signature"`. Pointers address Writ's NFC-normalized key
   * space rather than the original pre-normalization spelling.
   */
  dropFields?: Iterable<string>;
}

const EMPTY_DROP_SET: ReadonlySet<string> = new Set<string>();
const MAX_CANONICAL_DEPTH = 512;

/** Escape a single key/token into an RFC 6901 JSON Pointer reference token. */
function encodePointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

function normalizeDropSet(fields: Iterable<string> | undefined): ReadonlySet<string> {
  if (fields === undefined) return EMPTY_DROP_SET;
  const set = new Set<string>();
  for (const field of fields) {
    if (typeof field !== "string") {
      throw new CanonicalJsonError("dropFields entries must be strings");
    }
    // Omission is defined over the same NFC-normalized key space that Writ v1
    // serializes. A composed pointer therefore addresses a decomposed input
    // key (and vice versa).
    set.add(
      field.startsWith("/")
        ? field.normalize("NFC")
        : "/" + encodePointerToken(field.normalize("NFC")),
    );
  }
  return set;
}

/**
 * Serialize `value` as Writ Canonical JSON v1. The output is stable UTF-16
 * text; hashing is done over its UTF-8 encoding (see `hash.ts`).
 */
export function canonicalJson(value: unknown, options?: CanonicalOptions): string {
  const drops = normalizeDropSet(options?.dropFields);
  return serialize(value, "", drops, 0, new WeakSet<object>());
}

function serialize(
  value: unknown,
  pointer: string,
  drops: ReadonlySet<string>,
  depth: number,
  active: WeakSet<object>,
): string {
  if (depth > MAX_CANONICAL_DEPTH) {
    throw new CanonicalJsonError(
      `canonical JSON nesting exceeds ${MAX_CANONICAL_DEPTH}` +
        (pointer === "" ? "" : ` at ${pointer}`),
    );
  }
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return serializeString(value);
    case "number":
      return serializeNumber(value);
    case "boolean":
      return value ? "true" : "false";
    case "object": {
      if (active.has(value)) {
        throw new CanonicalJsonError(
          `cyclic value is not permitted in canonical JSON` +
            (pointer === "" ? "" : ` at ${pointer}`),
        );
      }
      active.add(value);
      try {
        return Array.isArray(value)
          ? serializeArray(value, pointer, drops, depth, active)
          : serializeObject(value as Record<string, unknown>, pointer, drops, depth, active);
      } finally {
        active.delete(value);
      }
    }
    default:
      // undefined, bigint, function, symbol
      throw new CanonicalJsonError(
        `cannot canonicalize value of type "${typeof value}"` +
          (pointer === "" ? "" : ` at ${pointer}`),
      );
  }
}

/**
 * Apply Writ's NFC transform, then use JCS-compatible escaping for valid
 * Unicode string data. `JSON.stringify` emits two-character escapes for `"`
 * `\` `\b` `\f` `\n` `\r` `\t`, lowercase `\u00xx` for the remaining C0
 * controls, and other characters (including non-ASCII) literally.
 */
function serializeString(value: string): string {
  return JSON.stringify(value.normalize("NFC"));
}

function serializeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new CanonicalJsonError(
      `non-finite numbers are not permitted in canonical JSON: ${String(value)}`,
    );
  }
  // `Object.is` distinguishes -0; RFC 8785 serializes both zeros as "0".
  if (value === 0) return "0";
  // ECMAScript `Number.prototype.toString()` is the RFC 8785 §3.2.2.3 format.
  return value.toString();
}

function serializeArray(
  value: unknown[],
  pointer: string,
  drops: ReadonlySet<string>,
  depth: number,
  active: WeakSet<object>,
): string {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new CanonicalJsonError(
      `unsupported array prototype` + (pointer === "" ? "" : ` at ${pointer}`),
    );
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new CanonicalJsonError(
      `symbol properties are not permitted on canonical JSON arrays` +
        (pointer === "" ? "" : ` at ${pointer}`),
    );
  }
  const propertyNames = Object.getOwnPropertyNames(value);
  if (
    propertyNames.length !== value.length + 1 ||
    !propertyNames.includes("length") ||
    Array.from({ length: value.length }, (_, index) => String(index)).some(
      (index) => !propertyNames.includes(index),
    )
  ) {
    throw new CanonicalJsonError(
      `canonical JSON arrays must be dense and have no named properties` +
        (pointer === "" ? "" : ` at ${pointer}`),
    );
  }
  const parts: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const childPointer = `${pointer}/${i}`;
    if (drops.has(childPointer)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new CanonicalJsonError(`array element at ${childPointer} must be a data property`);
    }
    if (descriptor.value === undefined) {
      throw new CanonicalJsonError(
        `array element at ${childPointer} is undefined; JSON has no undefined`,
      );
    }
    parts.push(serialize(descriptor.value, childPointer, drops, depth + 1, active));
  }
  return `[${parts.join(",")}]`;
}

interface ObjectEntry {
  origKey: string;
  normKey: string;
  value: unknown;
}

function serializeObject(
  value: Record<string, unknown>,
  pointer: string,
  drops: ReadonlySet<string>,
  depth: number,
  active: WeakSet<object>,
): string {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new CanonicalJsonError(
      `unsupported object prototype` + (pointer === "" ? "" : ` at ${pointer}`),
    );
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new CanonicalJsonError(
      `symbol properties are not permitted on canonical JSON objects` +
        (pointer === "" ? "" : ` at ${pointer}`),
    );
  }
  const keys = Object.keys(value);
  if (Object.getOwnPropertyNames(value).length !== keys.length) {
    throw new CanonicalJsonError(
      `non-enumerable properties are not permitted on canonical JSON objects` +
        (pointer === "" ? "" : ` at ${pointer}`),
    );
  }
  const entries: ObjectEntry[] = [];
  const seen = new Set<string>();
  for (const origKey of keys) {
    const normKey = origKey.normalize("NFC");
    const childPointer = `${pointer}/${encodePointerToken(normKey)}`;
    if (drops.has(childPointer)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, origKey);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new CanonicalJsonError(`object property at ${childPointer} must be a data property`);
    }
    const propertyValue = descriptor.value;
    // Omit undefined-valued properties, matching JSON.stringify semantics.
    if (propertyValue === undefined) continue;
    if (seen.has(normKey)) {
      throw new CanonicalJsonError(
        `duplicate object key after NFC normalization: ${JSON.stringify(normKey)}`,
      );
    }
    seen.add(normKey);
    entries.push({ origKey, normKey, value: propertyValue });
  }
  // Sort by UTF-16 code unit of the Writ-normalized key. JavaScript's `<` on
  // strings provides the ordering operation JCS specifies, but JCS would sort
  // the original key without NFC normalization.
  entries.sort((a, b) => (a.normKey < b.normKey ? -1 : a.normKey > b.normKey ? 1 : 0));

  const parts: string[] = [];
  for (const entry of entries) {
    const childPointer = `${pointer}/${encodePointerToken(entry.normKey)}`;
    parts.push(
      `${serializeString(entry.normKey)}:${serialize(entry.value, childPointer, drops, depth + 1, active)}`,
    );
  }
  return `{${parts.join(",")}}`;
}
