/**
 * Historical golden fixtures for Writ Canonical JSON v1 + SHA-256 hashing.
 *
 * `expectedCanonical` and `expectedHash` are retained as cross-platform
 * regression locks: any drift in canonicalization or hashing changes these
 * bytes and fails the suite. Independent shared-JCS and Writ-specific profile
 * vectors live in `profile-conformance.test.ts`.
 *
 * Non-ASCII is written with `\u` escapes so this source file stays pure ASCII
 * and unambiguous. At runtime `"café"` is the literal composed "café".
 */

export interface GoldenCase {
  readonly name: string;
  readonly input: unknown;
  readonly expectedCanonical: string;
  readonly expectedHash: string;
  readonly dropFields?: readonly string[];
}

/** Single-value cases: input canonicalizes to exactly `expectedCanonical`. */
export const goldenCases: readonly GoldenCase[] = [
  {
    name: "empty_object",
    input: {},
    expectedCanonical: "{}",
    expectedHash: "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
  },
  {
    name: "empty_array",
    input: [],
    expectedCanonical: "[]",
    expectedHash: "sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  },
  {
    name: "null_and_bool",
    input: { a: null, b: true, c: false },
    expectedCanonical: '{"a":null,"b":true,"c":false}',
    expectedHash: "sha256:17073ac6186d8c60c0c0da712ce30cdb52ed5a9155f616983da39a9785dce715",
  },
  {
    // Keys out of order (and an empty-string key); nested object keys sorted;
    // the inner array [3,2,1] keeps its order.
    name: "nested_sorted",
    input: { b: 1, a: 2, c: { z: [3, 2, 1], a: true }, "": 0 },
    expectedCanonical: '{"":0,"a":2,"b":1,"c":{"a":true,"z":[3,2,1]}}',
    expectedHash: "sha256:bef90c20e370394ecdce81d3df174419c764d743ae35fd1d49b020388201b7b8",
  },
  {
    // Locks ECMAScript number formatting: -0 -> 0, 1e21 -> 1e+21,
    // 1e-7 -> 1e-7, 0.000001 stays decimal, 9999999999999999 -> 1e16.
    // `Number("9999999999999999")` is the double 1e16 (written as a string only
    // to avoid a no-loss-of-precision lint error on the source literal).
    name: "numbers",
    input: {
      values: [0, -0, 1, -1, 100, 1e21, 1e-7, 0.000001, Number("9999999999999999"), 3.14, -12.5],
    },
    expectedCanonical: '{"values":[0,0,1,-1,100,1e+21,1e-7,0.000001,10000000000000000,3.14,-12.5]}',
    expectedHash: "sha256:056b04f5783b4b2e060a348f408a3bd593927a1f6a44cfb498c776d15f676ee9",
  },
  {
    name: "unicode_composed",
    input: { s: "café" },
    expectedCanonical: '{"s":"café"}',
    expectedHash: "sha256:298ebe9dfd0022919780451da01d6ff22cd701ae9f614b77522b751906ac2784",
  },
  {
    // JCS-compatible escaping after Writ's NFC step: quote, backslash, \n, \t,
    // and a C0 control (U+0001).
    name: "string_escapes",
    input: { s: 'a"b\\c\n\t\u0001' },
    expectedCanonical: '{"s":"a\\"b\\\\c\\n\\t\\u0001"}',
    expectedHash: "sha256:38ae1414fb5423abe35d41077957aafd1b0243ae7c6da745c7f541971f3821cd",
  },
  {
    // Transport fields dropped before hashing (a receipt's own hash/signature).
    name: "receipt_drop",
    input: {
      schema_version: "1.0.0",
      id: "r-1",
      result: "+1",
      canonical_hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      signature: { alg: "ed25519", sig: "AAAA" },
    },
    dropFields: ["/canonical_hash", "/signature"],
    expectedCanonical: '{"id":"r-1","result":"+1","schema_version":"1.0.0"}',
    expectedHash: "sha256:4ef2bc872b0b9f3fd4543401722980662057a6b60c1e3d3364d8f97b6a189ae8",
  },
];

/**
 * Equivalence groups: every input must canonicalize to the SAME bytes/hash.
 * Proves key-order independence and NFC normalization of values and keys.
 */
export interface EquivalenceGroup {
  readonly name: string;
  readonly inputs: readonly unknown[];
  readonly expectedCanonical: string;
  readonly expectedHash: string;
}

export const equivalenceGroups: readonly EquivalenceGroup[] = [
  {
    name: "key_reorder",
    inputs: [
      { a: 1, b: 2, c: 3 },
      { c: 3, b: 2, a: 1 },
      { b: 2, a: 1, c: 3 },
    ],
    expectedCanonical: '{"a":1,"b":2,"c":3}',
    expectedHash: "sha256:e6a3385fb77c287a712e7f406a451727f0625041823ecf23bea7ef39b2e39805",
  },
  {
    // Composed U+00E9 vs decomposed "e" + U+0301 (combining acute).
    name: "nfc_value",
    inputs: [{ name: "café" }, { name: "café" }],
    expectedCanonical: '{"name":"café"}',
    expectedHash: "sha256:645fa443126a8954fc6d871912b8fc67bc2ee8feae417efe55546251962ca74d",
  },
  {
    // Composed U+00EF vs decomposed "i" + U+0308 (combining diaeresis) in a KEY.
    name: "nfc_key",
    inputs: [{ ["naïve"]: 1 }, { ["naïve"]: 1 }],
    expectedCanonical: '{"naïve":1}',
    expectedHash: "sha256:3bb5a7d3e29960ef95a6a7b65d8237bf11f0ae714bbe7b71ebad8632578742a6",
  },
];

/** Pairs whose canonical forms MUST differ (array order is semantic). */
export interface DistinctnessPair {
  readonly name: string;
  readonly a: unknown;
  readonly b: unknown;
}

export const distinctnessPairs: readonly DistinctnessPair[] = [
  { name: "array_reorder", a: [1, 2, 3], b: [3, 2, 1] },
  { name: "nested_array_reorder", a: { xs: [1, 2] }, b: { xs: [2, 1] } },
];

/** Inputs that MUST throw `CanonicalJsonError`. */
export interface ThrowingCase {
  readonly name: string;
  readonly input: unknown;
}

export const throwingCases: readonly ThrowingCase[] = [
  { name: "nan", input: NaN },
  { name: "infinity", input: Infinity },
  { name: "negative_infinity", input: -Infinity },
  { name: "nan_nested", input: { x: NaN } },
  { name: "infinity_in_array", input: [1, Infinity, 3] },
  { name: "bigint", input: 10n },
  { name: "undefined_in_array", input: [1, undefined, 3] },
];
