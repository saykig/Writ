import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  evidencePassageSignature,
  logicalPassageConflicts,
  passageSignatureKey,
  resolveLogicalPassage,
  resolveSourceVersion,
  sha256Utf8Text,
  verifyEvidenceReferences,
  type EvidenceReference,
  type LogicalPassageOccurrence,
  type SourceVersionDeclaration,
} from "../src/index.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/aldera-ucdp-holdout.json", import.meta.url), "utf8"),
) as {
  source: SourceVersionDeclaration & Record<string, unknown>;
  reference: EvidenceReference & Record<string, unknown>;
};

const authority: SourceVersionDeclaration[] = [fixture.source];
const reference: EvidenceReference = fixture.reference;

function codes(values: readonly { code: string }[]): string[] {
  return values.map(({ code }) => code);
}

describe("exact UTF-8 passage hashing is distinct from canonical JSON", () => {
  const vectors = [
    ["space space", "sha256:40efc2c669a6e18c40c890f99719fc9f3efab119703658ca34b52164b68a5eda"],
    ["space space ", "sha256:f917f5182f4df6b9c0720936dd6b377c1c457c17182c47ef11c701be3458e79d"],
    ["space\u00a0space", "sha256:b21f516d46c09df3bf5f1eace4ac2ddbc72cee5c9b02c79972f960113c9b3461"],
    ["Café", "sha256:73473dcc12b763085904a5279d048c4d5b3b008c46f1f32443b99de04aa83a14"],
    ["Café", "sha256:c42cc7a1ca08364b6fd859fa50d2454730a8236290a423373cc630da77c6d711"],
    ["“quoted”", "sha256:675587678ab187204408a9804299a93a49763fc568c472e5663e86cb1d62521c"],
    ['"quoted"', "sha256:272fca25899893eeb27b89583d5c81b8a4ac5af4d1e37e3909d879947303c1c5"],
  ] as const;

  test("pins byte-sensitive whitespace, NBSP, normalization, and quotation vectors", () => {
    for (const [quote, expected] of vectors) expect(sha256Utf8Text(quote)).toBe(expected);
    expect(new Set(vectors.map(([quote]) => sha256Utf8Text(quote))).size).toBe(vectors.length);
  });
});

describe("caller-supplied source and document-version authority", () => {
  test("resolves the tracked Aldera UCDP authority shape without its extra fields", () => {
    expect(
      resolveSourceVersion(authority, reference.source_id, reference.document_version_id),
    ).toEqual({
      status: "resolved",
      source: {
        source_id: fixture.source.source_id,
        document_version_id: fixture.source.document_version_id,
        document_hash: fixture.source.document_hash,
      },
      matches: [
        {
          source_id: fixture.source.source_id,
          document_version_id: fixture.source.document_version_id,
          document_hash: fixture.source.document_hash,
        },
      ],
    });
    expect(verifyEvidenceReferences([fixture.reference], authority)).toEqual([]);
  });

  test("distinguishes missing source, wrong version, and duplicate exact authority", () => {
    expect(resolveSourceVersion(authority, "missing", reference.document_version_id).status).toBe(
      "missing_source",
    );
    expect(resolveSourceVersion(authority, reference.source_id, "ucdp.other.version").status).toBe(
      "version_mismatch",
    );
    expect(
      resolveSourceVersion(
        [fixture.source, structuredClone(fixture.source)],
        reference.source_id,
        reference.document_version_id,
      ).status,
    ).toBe("ambiguous");
  });

  test("is deterministic under authority ordering", () => {
    const another = {
      source_id: reference.source_id,
      document_version_id: "ucdp.brd_codebook.v25_1",
      document_hash: `sha256:${"1".repeat(64)}`,
    };
    const forward = resolveSourceVersion(
      [fixture.source, another],
      reference.source_id,
      "missing-version",
    );
    const reversed = resolveSourceVersion(
      [another, fixture.source],
      reference.source_id,
      "missing-version",
    );
    expect(reversed).toEqual(forward);
  });
});

describe("generic evidence-reference verification", () => {
  test("reports every required negative case with stable codes", () => {
    expect(
      codes(verifyEvidenceReferences([{ ...reference, source_id: "missing" }], authority)),
    ).toEqual(["PROVENANCE_SOURCE_NOT_FOUND"]);
    expect(
      codes(
        verifyEvidenceReferences(
          [{ ...reference, document_version_id: "ucdp.other.version" }],
          authority,
        ),
      ),
    ).toEqual(["PROVENANCE_SOURCE_VERSION_MISMATCH"]);
    expect(
      codes(
        verifyEvidenceReferences([reference], [fixture.source, structuredClone(fixture.source)]),
      ),
    ).toEqual(["PROVENANCE_REFERENCE_AMBIGUOUS"]);
    expect(
      codes(
        verifyEvidenceReferences(
          [{ ...reference, document_hash: `sha256:${"2".repeat(64)}` }],
          authority,
        ),
      ),
    ).toContain("PROVENANCE_SOURCE_MISMATCH");
    expect(
      codes(
        verifyEvidenceReferences(
          [{ ...reference, passage_hash: `sha256:${"3".repeat(64)}` }],
          authority,
        ),
      ),
    ).toContain("PROVENANCE_PASSAGE_HASH_MISMATCH");
  });

  test("fails closed on malformed references while allowing consumer extension fields", () => {
    expect(verifyEvidenceReferences([fixture.reference], authority)).toEqual([]);
    for (const malformed of [
      null,
      {},
      { ...reference, source_id: "" },
      { ...reference, quote: "" },
      { ...reference, passage_hash: "not-a-hash" },
    ]) {
      expect(codes(verifyEvidenceReferences([malformed], authority))).toEqual([
        "PROVENANCE_EVIDENCE_REFERENCE_INVALID",
      ]);
    }
  });

  test("coalesces identical passage signatures and detects every signature-field conflict", () => {
    expect(verifyEvidenceReferences([reference, structuredClone(reference)], authority)).toEqual(
      [],
    );

    const mutations: Array<Partial<EvidenceReference>> = [
      { source_id: "other-source" },
      { document_version_id: "other-version" },
      { locator: "other-locator" },
      { quote: "different", passage_hash: sha256Utf8Text("different") },
      { passage_hash: `sha256:${"4".repeat(64)}` },
      { document_hash: `sha256:${"5".repeat(64)}` },
    ];
    for (const mutation of mutations) {
      expect(
        codes(verifyEvidenceReferences([reference, { ...reference, ...mutation }], authority)),
      ).toContain("PROVENANCE_PASSAGE_CONFLICT");
    }
  });

  test("is deterministic under caller and registry ordering", () => {
    const wrongHash = { ...reference, passage_hash: `sha256:${"6".repeat(64)}` };
    const conflict = {
      ...reference,
      quote: "different",
      passage_hash: sha256Utf8Text("different"),
    };
    const duplicateAuthority = [fixture.source, structuredClone(fixture.source)];
    const forward = verifyEvidenceReferences([reference, wrongHash, conflict], duplicateAuthority);
    const reversed = verifyEvidenceReferences(
      [conflict, wrongHash, reference],
      [...duplicateAuthority].reverse(),
    );
    expect(reversed).toEqual(forward);
  });
});

describe("portable logical passage resolution", () => {
  function occurrence(
    id: string,
    value: EvidenceReference,
  ): LogicalPassageOccurrence<EvidenceReference> {
    return {
      passageId: value.passage_id,
      signature: evidencePassageSignature(value),
      occurrenceId: id,
      context: value,
    };
  }

  test("resolves identical occurrences and conflicts independently of input order", () => {
    const identical = [occurrence("b", reference), occurrence("a", structuredClone(reference))];
    expect(resolveLogicalPassage(identical, reference.passage_id).status).toBe("resolved");

    const conflicting = [
      ...identical,
      occurrence("c", { ...reference, locator: "different locator" }),
    ];
    const forward = logicalPassageConflicts(conflicting);
    const reversed = logicalPassageConflicts([...conflicting].reverse());
    expect(forward).toHaveLength(1);
    expect(reversed).toEqual(forward);
    expect(forward[0]!.signatureKeys).toContain(
      passageSignatureKey(evidencePassageSignature(reference)),
    );
  });
});
