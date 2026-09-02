import { expect, test, describe } from "bun:test";
import { createHash } from "node:crypto";
import { canonicalJson, sha256Canonical, CanonicalJsonError } from "../src/index.js";
import {
  goldenCases,
  equivalenceGroups,
  distinctnessPairs,
  throwingCases,
} from "./golden/cases.js";

const HASH_RE = /^sha256:[0-9a-f]{64}$/;

function optsFor(dropFields?: readonly string[]) {
  return dropFields ? { dropFields } : undefined;
}

describe("golden cases: canonical bytes and hash are pinned", () => {
  for (const c of goldenCases) {
    test(c.name, () => {
      const canonical = canonicalJson(c.input, optsFor(c.dropFields));
      const hash = sha256Canonical(c.input, optsFor(c.dropFields));
      expect(canonical).toBe(c.expectedCanonical);
      expect(hash).toBe(c.expectedHash);
      expect(hash).toMatch(HASH_RE);
    });
  }
});

describe("equivalence groups: reordering keys / NFC do NOT change bytes or hash", () => {
  for (const g of equivalenceGroups) {
    test(g.name, () => {
      for (const input of g.inputs) {
        expect(canonicalJson(input)).toBe(g.expectedCanonical);
        expect(sha256Canonical(input)).toBe(g.expectedHash);
      }
    });
  }
});

describe("distinctness: reordering array elements DOES change bytes and hash", () => {
  for (const p of distinctnessPairs) {
    test(p.name, () => {
      expect(canonicalJson(p.a)).not.toBe(canonicalJson(p.b));
      expect(sha256Canonical(p.a)).not.toBe(sha256Canonical(p.b));
    });
  }
});

describe("rejected inputs throw CanonicalJsonError", () => {
  for (const t of throwingCases) {
    test(t.name, () => {
      expect(() => canonicalJson(t.input)).toThrow(CanonicalJsonError);
      expect(() => sha256Canonical(t.input)).toThrow(CanonicalJsonError);
    });
  }
});

describe("the accepted runtime domain is plain in-memory JSON", () => {
  class Instance {
    value = 1;
  }

  const customPrototype = Object.create({ inherited: true }) as Record<string, unknown>;
  customPrototype.value = 1;
  const customArray = [1, 2];
  Object.setPrototypeOf(customArray, null);

  const unsupported = [
    new Date(0),
    new Map([["value", 1]]),
    new Set([1]),
    /value/u,
    new Number(1),
    new String("value"),
    new Boolean(true),
    new Instance(),
    customPrototype,
    customArray,
  ];

  test("rejects runtime objects that would otherwise collapse to JSON identities", () => {
    for (const value of unsupported) {
      expect(() => canonicalJson(value)).toThrow(CanonicalJsonError);
      expect(() => sha256Canonical(value)).toThrow(CanonicalJsonError);
    }
  });

  test("rejects non-data properties that JSON serialization would hide or execute", () => {
    const symbolObject = { value: 1, [Symbol("hidden")]: 2 };
    const hiddenObject = { value: 1 };
    Object.defineProperty(hiddenObject, "hidden", { value: 2 });
    const accessorObject = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => 1,
    });
    const namedArray = [1, 2] as number[] & { named?: number };
    namedArray.named = 3;
    const accessorArray = [1];
    Object.defineProperty(accessorArray, "0", { enumerable: true, get: () => 1 });
    for (const value of [symbolObject, hiddenObject, accessorObject, namedArray, accessorArray]) {
      expect(() => canonicalJson(value)).toThrow(CanonicalJsonError);
    }
  });

  test("accepts a null-prototype plain record", () => {
    const value = Object.create(null) as Record<string, unknown>;
    value.b = 2;
    value.a = 1;
    expect(canonicalJson(value)).toBe('{"a":1,"b":2}');
  });

  test("rejects cyclic objects and arrays with bounded typed errors", () => {
    const object: Record<string, unknown> = {};
    object.self = object;
    const array: unknown[] = [];
    array.push(array);
    for (const value of [object, array]) {
      expect(() => canonicalJson(value)).toThrow(CanonicalJsonError);
      expect(() => canonicalJson(value)).toThrow(/cyclic value/);
    }
  });

  test("bounds hostile nesting while preserving values at the guard", () => {
    const nested = (depth: number): unknown => {
      let value: unknown = 0;
      for (let index = 0; index < depth; index += 1) value = { value };
      return value;
    };
    expect(() => canonicalJson(nested(512))).not.toThrow();
    expect(() => canonicalJson(nested(513))).toThrow(CanonicalJsonError);
    expect(() => canonicalJson(nested(513))).toThrow(/nesting exceeds 512/);
  });
});

test("insignificant whitespace in the source JSON text does not change bytes or hash", () => {
  const compact = '{"b":1,"a":[1,2,3],"c":{"y":2,"x":1}}';
  const spaced = `{
    "a" : [ 1, 2, 3 ],
    "c" : { "x" : 1 , "y" : 2 } ,
    "b" : 1
  }`;
  const a = JSON.parse(compact) as unknown;
  const b = JSON.parse(spaced) as unknown;
  expect(canonicalJson(a)).toBe(canonicalJson(b));
  expect(sha256Canonical(a)).toBe(sha256Canonical(b));
  // ...and the shared array order is still preserved.
  expect(canonicalJson(a)).toBe('{"a":[1,2,3],"b":1,"c":{"x":1,"y":2}}');
});

test("the documented SHA-256 formula over canonical UTF-8 matches the pinned hash", () => {
  // The pinned literal is the regression oracle; this recomputation makes the
  // canonical-text -> UTF-8 -> SHA-256 formula explicit.
  for (const c of goldenCases) {
    const canonical = canonicalJson(c.input, optsFor(c.dropFields));
    const independent = "sha256:" + createHash("sha256").update(canonical, "utf8").digest("hex");
    expect(independent).toBe(c.expectedHash);
  }
});

test("determinism: canonicalizing twice yields identical bytes", () => {
  const value = { z: [3, 2, 1], a: { d: 4, c: 3 }, m: "café" };
  expect(canonicalJson(value)).toBe(canonicalJson(value));
  expect(sha256Canonical(value)).toBe(sha256Canonical(value));
});

test("-0 and 0 hash identically", () => {
  expect(sha256Canonical({ n: -0 })).toBe(sha256Canonical({ n: 0 }));
  expect(canonicalJson({ n: -0 })).toBe('{"n":0}');
});

test("undefined-valued object properties fail closed", () => {
  expect(() => canonicalJson({ a: 1, b: undefined, c: 3 })).toThrow(CanonicalJsonError);
  expect(() => sha256Canonical({ x: undefined })).toThrow(/JSON has no undefined/);
});

test("pins the IEEE-754 parser boundary beyond safe integer precision", () => {
  const first = JSON.parse('{"n":9007199254740992}') as unknown;
  const rounded = JSON.parse('{"n":9007199254740993}') as unknown;

  expect(first).toEqual(rounded);
  expect(canonicalJson(first)).toBe(canonicalJson(rounded));
  expect(sha256Canonical(first)).toBe(sha256Canonical(rounded));
  expect('{"n":9007199254740992}').not.toBe('{"n":9007199254740993}');
});

describe("dropFields", () => {
  test("bare key name is treated as a top-level pointer", () => {
    const value = { keep: 1, drop_me: 2 };
    expect(canonicalJson(value, { dropFields: ["drop_me"] })).toBe('{"keep":1}');
    expect(canonicalJson(value, { dropFields: ["/drop_me"] })).toBe('{"keep":1}');
  });

  test("nested JSON pointer drops a nested field", () => {
    const value = { a: { secret: "x", keep: 1 }, b: 2 };
    expect(canonicalJson(value, { dropFields: ["/a/secret"] })).toBe('{"a":{"keep":1},"b":2}');
  });

  test("addresses fields in the NFC-normalized key space", () => {
    const composed = { "caf\u00e9": "drop", keep: true };
    const decomposed = { "cafe\u0301": "drop", keep: true };
    const options = { dropFields: ["/caf\u00e9"] };
    expect(canonicalJson(composed, options)).toBe('{"keep":true}');
    expect(canonicalJson(decomposed, options)).toBe('{"keep":true}');
    expect(sha256Canonical(composed, options)).toBe(sha256Canonical(decomposed, options));

    const nested = { "cafe\u0301": { "re\u0301sume\u0301": "drop", keep: true } };
    expect(canonicalJson(nested, { dropFields: ["/caf\u00e9/r\u00e9sum\u00e9"] })).toBe(
      '{"caf\u00e9":{"keep":true}}',
    );
  });

  test("drops every colliding NFC spelling when the normalized path is omitted", () => {
    const value = { "caf\u00e9": 1, "cafe\u0301": 2, keep: true };
    expect(canonicalJson(value, { dropFields: ["/cafe\u0301"] })).toBe('{"keep":true}');
    expect(() => canonicalJson(value)).toThrow(/duplicate object key/);
  });

  test("dropping a field changes the hash; the field's value does not once dropped", () => {
    const base = { id: "x", volatile: "one" };
    const changed = { id: "x", volatile: "two" };
    // Without dropping, the volatile value matters.
    expect(sha256Canonical(base)).not.toBe(sha256Canonical(changed));
    // With the field dropped, both hash identically.
    const opts = { dropFields: ["/volatile"] };
    expect(sha256Canonical(base, opts)).toBe(sha256Canonical(changed, opts));
  });

  test("is an explicit Writ identity profile, not generic object equality", () => {
    const profiled = sha256Canonical(
      { id: "x", decision: "approve" },
      { dropFields: ["/decision"] },
    );
    expect(profiled).toBe(sha256Canonical({ id: "x" }));
    expect(sha256Canonical({ id: "x", decision: "approve" })).not.toBe(profiled);
  });
});
