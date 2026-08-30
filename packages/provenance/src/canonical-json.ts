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
 * string, array, and plain object. Any other runtime type (`undefined`,
 * `bigint`, function, symbol) is rejected with {@link CanonicalJsonError};
 * `undefined`-valued object properties are omitted, matching JSON semantics.
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
   * equivalent to `"/signature"`.
   */
  dropFields?: Iterable<string>;
}

const EMPTY_DROP_SET: ReadonlySet<string> = new Set<string>();

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
    set.add(field.startsWith("/") ? field : "/" + encodePointerToken(field));
  }
  return set;
}

/**
 * Serialize `value` as Writ Canonical JSON v1. The output is stable UTF-16
 * text; hashing is done over its UTF-8 encoding (see `hash.ts`).
 */
export function canonicalJson(value: unknown, options?: CanonicalOptions): string {
  const drops = normalizeDropSet(options?.dropFields);
  return serialize(value, "", drops);
}

function serialize(value: unknown, pointer: string, drops: ReadonlySet<string>): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return serializeString(value);
    case "number":
      return serializeNumber(value);
    case "boolean":
      return value ? "true" : "false";
    case "object":
      return Array.isArray(value)
        ? serializeArray(value, pointer, drops)
        : serializeObject(value as Record<string, unknown>, pointer, drops);
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

function serializeArray(value: unknown[], pointer: string, drops: ReadonlySet<string>): string {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const childPointer = `${pointer}/${i}`;
    if (drops.has(childPointer)) continue;
    const element = value[i];
    if (element === undefined) {
      throw new CanonicalJsonError(
        `array element at ${childPointer} is undefined; JSON has no undefined`,
      );
    }
    parts.push(serialize(element, childPointer, drops));
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
): string {
  const entries: ObjectEntry[] = [];
  const seen = new Set<string>();
  for (const origKey of Object.keys(value)) {
    const childPointer = `${pointer}/${encodePointerToken(origKey)}`;
    if (drops.has(childPointer)) continue;
    const propertyValue = value[origKey];
    // Omit undefined-valued properties, matching JSON.stringify semantics.
    if (propertyValue === undefined) continue;
    const normKey = origKey.normalize("NFC");
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
    const childPointer = `${pointer}/${encodePointerToken(entry.origKey)}`;
    parts.push(`${serializeString(entry.normKey)}:${serialize(entry.value, childPointer, drops)}`);
  }
  return `{${parts.join(",")}}`;
}
