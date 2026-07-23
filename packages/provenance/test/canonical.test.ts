import { expect, test, describe } from "bun:test";
import { createHash } from "node:crypto";
import {
  canonicalJson,
  sha256Canonical,
  CanonicalJsonError,
  methodologyBundleHash,
  evidenceSnapshotHash,
  interpretationProfileHash,
  evaluatorBuildHash,
  receiptHash,
  releaseManifestHash,
} from "../src/index.js";
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

test("independent verification: node:crypto over the canonical string matches the pinned hash", () => {
  // Guards against a self-consistent-but-wrong hash step: the implementation
  // hashes with Bun.CryptoHasher, this recomputes with node:crypto.
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

test("undefined-valued object properties are omitted (JSON semantics)", () => {
  expect(canonicalJson({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}');
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

  test("dropping a field changes the hash; the field's value does not once dropped", () => {
    const base = { id: "x", volatile: "one" };
    const changed = { id: "x", volatile: "two" };
    // Without dropping, the volatile value matters.
    expect(sha256Canonical(base)).not.toBe(sha256Canonical(changed));
    // With the field dropped, both hash identically.
    const opts = { dropFields: ["/volatile"] };
    expect(sha256Canonical(base, opts)).toBe(sha256Canonical(changed, opts));
  });
});

describe("named hash helpers", () => {
  const receipt = {
    schema_version: "1.0.0",
    id: "receipt-1",
    result: "+1",
    result_status: "supported",
    dependencies: {
      methodology_bundle_hash: "sha256:" + "a".repeat(64),
      evidence_snapshot_hash: "sha256:" + "b".repeat(64),
      interpretation_profile_hash: "sha256:" + "c".repeat(64),
      evaluator_build_hash: "sha256:" + "d".repeat(64),
      source_snapshot_ids: ["s1", "s2"],
    },
    canonical_hash: "sha256:" + "0".repeat(64),
    signature: { alg: "ed25519", sig: "PLACEHOLDER" },
  };

  test("all helpers return the sha256:<64 hex> shape", () => {
    expect(methodologyBundleHash({ x: 1 })).toMatch(HASH_RE);
    expect(evidenceSnapshotHash({ x: 1 })).toMatch(HASH_RE);
    expect(interpretationProfileHash({ x: 1 })).toMatch(HASH_RE);
    expect(evaluatorBuildHash({ x: 1 })).toMatch(HASH_RE);
    expect(receiptHash(receipt)).toMatch(HASH_RE);
    expect(releaseManifestHash({ manifest_hash: "sha256:" + "0".repeat(64) })).toMatch(HASH_RE);
  });

  test("receiptHash ignores its own canonical_hash and signature", () => {
    const withDifferentEnvelope = {
      ...receipt,
      canonical_hash: "sha256:" + "f".repeat(64),
      signature: { alg: "ed25519", sig: "A_COMPLETELY_DIFFERENT_SIGNATURE" },
    };
    expect(receiptHash(withDifferentEnvelope)).toBe(receiptHash(receipt));
  });

  test("receiptHash still depends on substantive fields", () => {
    const changed = { ...receipt, result: "-1" };
    expect(receiptHash(changed)).not.toBe(receiptHash(receipt));
  });

  test("receiptHash equals sha256Canonical with canonical_hash+signature dropped", () => {
    expect(receiptHash(receipt)).toBe(
      sha256Canonical(receipt, { dropFields: ["/canonical_hash", "/signature"] }),
    );
  });

  test("releaseManifestHash ignores its own manifest_hash and signature", () => {
    const manifest = {
      schema_version: "1.0.0",
      id: "rel-1",
      name: "Release",
      version: "1.0.0",
      status: "candidate",
      manifest_hash: "sha256:" + "0".repeat(64),
      signature: { sig: "X" },
    };
    const other = {
      ...manifest,
      manifest_hash: "sha256:" + "e".repeat(64),
      signature: { sig: "Y" },
    };
    expect(releaseManifestHash(manifest)).toBe(releaseManifestHash(other));
    // Status IS substantive content and still affects the hash.
    expect(releaseManifestHash({ ...manifest, status: "published" })).not.toBe(
      releaseManifestHash(manifest),
    );
  });

  test("caller dropFields compose with a helper's default drops", () => {
    const a = { ...receipt, extra: "one" };
    const b = { ...receipt, extra: "two" };
    const opts = { dropFields: ["/extra"] };
    expect(receiptHash(a, opts)).toBe(receiptHash(b, opts));
  });
});
