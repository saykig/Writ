import { describe, expect, test } from "bun:test";

import { canonicalJson, sha256Canonical } from "../src/index.js";

describe("Writ Canonical JSON v1 profile vectors", () => {
  test("matches ordinary JCS-compatible serialization behavior on the shared subset", () => {
    const input = { z: [3, true, null], a: 'line\nquote"', m: 1e30 };
    const expected = '{"a":"line\\nquote\\"","m":1e+30,"z":[3,true,null]}';

    expect(canonicalJson(input)).toBe(expected);
  });

  test("sorts the RFC 8785 property-order vector after Writ key normalization", () => {
    const input = {
      "\u20ac": "Euro Sign",
      "\r": "Carriage Return",
      "\ufb33": "Hebrew Letter Dalet With Dagesh",
      "1": "One",
      "\ud83d\ude00": "Emoji: Grinning Face",
      "\u0080": "Control",
      "\u00f6": "Latin Small Letter O With Diaeresis",
    };
    const writExpected =
      '{"\\r":"Carriage Return","1":"One","\u0080":"Control","\u00f6":"Latin Small Letter O With Diaeresis","\u05d3\u05bc":"Hebrew Letter Dalet With Dagesh","\u20ac":"Euro Sign","\ud83d\ude00":"Emoji: Grinning Face"}';
    const jcsAsIsExpected =
      '{"\\r":"Carriage Return","1":"One","\u0080":"Control","\u00f6":"Latin Small Letter O With Diaeresis","\u20ac":"Euro Sign","\ud83d\ude00":"Emoji: Grinning Face","\ufb33":"Hebrew Letter Dalet With Dagesh"}';

    expect(canonicalJson(input)).toBe(writExpected);
    expect(canonicalJson(input)).not.toBe(jcsAsIsExpected);
  });

  test("pins finite ECMAScript number serialization relied upon by Writ", () => {
    const input = [
      0,
      -0,
      Number("333333333.33333329"),
      1e30,
      4.5,
      2e-3,
      1e-27,
      1e21,
      1e-7,
      0.000001,
      Number("9999999999999999"),
    ];
    const expected =
      "[0,0,333333333.3333333,1e+30,4.5,0.002,1e-27,1e+21,1e-7,0.000001,10000000000000000]";

    expect(canonicalJson(input)).toBe(expected);
  });

  test("NFC-normalizes string values and keys instead of preserving JCS input bytes", () => {
    const input = { ["nai\u0308ve"]: "cafe\u0301" };
    const writExpected = '{"na\u00efve":"caf\u00e9"}';
    const jcsAsIsRepresentation = '{"nai\u0308ve":"cafe\u0301"}';

    expect(canonicalJson(input)).toBe(writExpected);
    expect(canonicalJson(input)).not.toBe(jcsAsIsRepresentation);
  });

  test("applies Writ dropFields before canonicalization", () => {
    const input = {
      id: "record-1",
      volatile: "transport-only",
      nested: { keep: true, signature: "self-reference" },
    };
    const expected = '{"id":"record-1","nested":{"keep":true}}';

    expect(canonicalJson(input, { dropFields: ["/volatile", "/nested/signature"] })).toBe(expected);
    expect(canonicalJson(input)).not.toBe(expected);
  });

  test("preserves representative existing Writ canonical bytes and hashes", () => {
    const nested = { b: 1, a: 2, c: { z: [3, 2, 1], a: true }, "": 0 };
    expect(canonicalJson(nested)).toBe('{"":0,"a":2,"b":1,"c":{"a":true,"z":[3,2,1]}}');
    expect(sha256Canonical(nested)).toBe(
      "sha256:bef90c20e370394ecdce81d3df174419c764d743ae35fd1d49b020388201b7b8",
    );

    const receipt = {
      schema_version: "1.0.0",
      id: "r-1",
      result: "+1",
      canonical_hash: "sha256:" + "0".repeat(64),
      signature: { alg: "ed25519", sig: "AAAA" },
    };
    const options = { dropFields: ["/canonical_hash", "/signature"] };
    expect(canonicalJson(receipt, options)).toBe(
      '{"id":"r-1","result":"+1","schema_version":"1.0.0"}',
    );
    expect(sha256Canonical(receipt, options)).toBe(
      "sha256:4ef2bc872b0b9f3fd4543401722980662057a6b60c1e3d3364d8f97b6a189ae8",
    );
  });
});
