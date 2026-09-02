import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  DeclaredReferenceInputError,
  evidencePassageSignature,
  IllFormedUnicodeError,
  LogicalPassageIdentityError,
  LogicalPassageOccurrenceError,
  logicalPassageConflicts,
  passageSignatureKey,
  resolveLogicalPassage,
  resolveSourceVersion,
  sha256Canonical,
  sha256Utf8Text,
  verifyEvidenceReferences,
  type DeclaredTextReference,
  type LogicalPassageOccurrence,
  type PassageSignature,
  type SourceVersionDeclaration,
  type SourceVersionResolution,
} from "../src/index.js";

interface AlderaOracleFixture {
  oracle: {
    repository: string;
    commit: string;
    manifest: string;
    registry: string;
    tracked_source_metadata: string;
    untracked_generated_receipt: string;
    untracked_artifacts: string[];
    attribution: string;
    license: string;
    license_url: string;
  };
  sources: Array<SourceVersionDeclaration & Record<string, unknown>>;
  references: Array<DeclaredTextReference & Record<string, unknown>>;
  expected: {
    source_resolution: Array<SourceVersionResolution["status"]>;
    verification_codes: string[];
    combined_conflict_passage_ids: string[];
  };
}

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/aldera-ucdp-holdout.json", import.meta.url), "utf8"),
) as AlderaOracleFixture;
const authority: SourceVersionDeclaration[] = fixture.sources;
const reference = fixture.references[0]!;

function codes(values: readonly { code: string }[]): string[] {
  return values.map(({ code }) => code);
}

function occurrence<T>(
  id: string,
  value: DeclaredTextReference,
  context: T,
): LogicalPassageOccurrence<T> {
  return {
    passageId: value.passage_id,
    signature: evidencePassageSignature(value),
    occurrenceId: id,
    context,
  };
}

describe("exact UTF-8 declared-text hashing", () => {
  const vectors = [
    ["\ufffd", "sha256:83d544ccc223c057d2bf80d3f2a32982c32c3c0db8e2674820da5064783fb097"],
    ["\ud83d\ude00", "sha256:f0443a342c5ef54783a111b51ba56c938e474c32324d90c3a60c9c8e3a37e2d9"],
    ["Caf\u00e9", "sha256:73473dcc12b763085904a5279d048c4d5b3b008c46f1f32443b99de04aa83a14"],
    ["Cafe\u0301", "sha256:c42cc7a1ca08364b6fd859fa50d2454730a8236290a423373cc630da77c6d711"],
    ["line1\nline2", "sha256:683376e290829b482c2655745caffa7a1dccfa10afaa62dac2b42dd6c68d0f83"],
    ["line1\r\nline2", "sha256:d14a91a6d1c6ee83bf0c774ebecbee6d8b393b395dae29eea839c354d6fba9c0"],
    ["a\u00a0b", "sha256:9507017c6d887511a5a6ac28ea7e3a438882576e1bd76fe3df27a336f49c263b"],
    ["a\tb", "sha256:894891f8b78a9945b0aa07e70d5f71f10b1f1990af127de561cc0ac36024c188"],
    [" a ", "sha256:cbf7f30004f3667cb093b3c7b55169a90e3f0044f6ea3ff93d3f75427a72e377"],
    ["\ufefftext", "sha256:3f290fb3a24328c76f4d09294c8be46a8c10c4a7ac8a7642782c7152d2761a13"],
    ["a\u200bb", "sha256:8df62aef5f92e4c30c0c938497f55f60078c361a476e7e0448485194ad79f884"],
  ] as const;

  test("pins valid replacement, pair, normalization, line-ending, and whitespace bytes", () => {
    for (const [quote, expected] of vectors) expect(sha256Utf8Text(quote)).toBe(expected);
    expect(new Set(vectors.map(([quote]) => sha256Utf8Text(quote))).size).toBe(vectors.length);
  });

  test("rejects unpaired surrogates instead of hashing replacement bytes", () => {
    for (const malformed of ["\ud800", "\udc00", "prefix\ud800suffix", "prefix\udc00suffix"]) {
      expect(() => sha256Utf8Text(malformed)).toThrow(IllFormedUnicodeError);
    }
    expect(sha256Utf8Text("\ufffd")).not.toBe(sha256Utf8Text("\ud83d\ude00"));
  });

  test("fails malformed quote references closed", () => {
    expect(codes(verifyEvidenceReferences([{ ...reference, quote: "\ud800" }], authority))).toEqual(
      ["PROVENANCE_EVIDENCE_REFERENCE_INVALID"],
    );
  });
});

describe("passage signature identity", () => {
  test("is independent of JavaScript property insertion order", () => {
    const signature = evidencePassageSignature(reference);
    const reversed = Object.fromEntries(
      Object.entries(signature).reverse(),
    ) as unknown as PassageSignature;
    const permuted: PassageSignature = {
      quote: signature.quote,
      document_hash: signature.document_hash,
      source_id: signature.source_id,
      passage_hash: signature.passage_hash,
      locator: signature.locator,
      document_version_id: signature.document_version_id,
    };
    expect(passageSignatureKey(reversed)).toBe(passageSignatureKey(signature));
    expect(passageSignatureKey(permuted)).toBe(passageSignatureKey(signature));
  });

  test("does not canonicalize byte-sensitive signature fields", () => {
    const composed = { ...evidencePassageSignature(reference), quote: "Caf\u00e9" };
    const decomposed = { ...composed, quote: "Cafe\u0301" };
    expect(passageSignatureKey(composed)).not.toBe(passageSignatureKey(decomposed));
  });
});

describe("caller-supplied source and document-version authority", () => {
  test("resolves extension-bearing declarations but returns only the mechanical projection", () => {
    const source = fixture.sources[0]!;
    expect(resolveSourceVersion([source], source.source_id, source.document_version_id)).toEqual({
      status: "resolved",
      source: {
        source_id: source.source_id,
        document_version_id: source.document_version_id,
        document_hash: source.document_hash,
      },
      matches: [
        {
          source_id: source.source_id,
          document_version_id: source.document_version_id,
          document_hash: source.document_hash,
        },
      ],
    });
  });

  test("fails closed on every malformed authority shape", () => {
    const valid = fixture.sources[0]!;
    const malformed = [
      null,
      {},
      { document_version_id: valid.document_version_id, document_hash: valid.document_hash },
      { ...valid, source_id: "" },
      { ...valid, document_version_id: "" },
      { ...valid, document_hash: "not-a-hash" },
      { ...valid, document_hash: valid.document_hash.toUpperCase() },
      { ...valid, source_id: 7 },
      { ...valid, document_version_id: false },
      { ...valid, document_hash: 7 },
    ];
    for (const value of malformed) {
      expect(resolveSourceVersion([value], valid.source_id, valid.document_version_id)).toEqual({
        status: "invalid_authority",
        matches: [],
        invalidCount: 1,
      });
      expect(codes(verifyEvidenceReferences([reference], [value]))).toEqual([
        "PROVENANCE_AUTHORITY_INVALID",
      ]);
    }
  });

  test("does not discard a malformed declaration beside a valid duplicate", () => {
    const malformedDuplicate = { ...fixture.sources[0]!, document_hash: "bad" };
    expect(
      resolveSourceVersion(
        [fixture.sources[0]!, malformedDuplicate],
        reference.source_id,
        reference.document_version_id,
      ),
    ).toEqual({ status: "invalid_authority", matches: [], invalidCount: 1 });
    expect(
      codes(verifyEvidenceReferences([reference], [fixture.sources[0]!, malformedDuplicate])),
    ).toEqual(["PROVENANCE_AUTHORITY_INVALID"]);
  });

  test("reports malformed authority even when no valid reference reaches resolution", () => {
    const malformed = { ...fixture.sources[0]!, document_hash: "bad" };
    expect(codes(verifyEvidenceReferences([], [malformed]))).toEqual([
      "PROVENANCE_AUTHORITY_INVALID",
    ]);
    expect(codes(verifyEvidenceReferences([null, { passage_id: "broken" }], [malformed]))).toEqual([
      "PROVENANCE_AUTHORITY_INVALID",
      "PROVENANCE_EVIDENCE_REFERENCE_INVALID",
      "PROVENANCE_EVIDENCE_REFERENCE_INVALID",
    ]);
  });

  test("treats throwing authority accessors as malformed without invoking them", () => {
    for (const field of ["source_id", "document_version_id", "document_hash"] as const) {
      const item = { ...fixture.sources[0]! };
      Object.defineProperty(item, field, {
        enumerable: true,
        get: () => {
          throw new Error(`must not invoke authority ${field}`);
        },
      });
      expect(() => verifyEvidenceReferences([], [item])).not.toThrow();
      expect(codes(verifyEvidenceReferences([], [item]))).toEqual(["PROVENANCE_AUTHORITY_INVALID"]);
      expect(
        resolveSourceVersion([item], reference.source_id, reference.document_version_id),
      ).toEqual({
        status: "invalid_authority",
        matches: [],
        invalidCount: 1,
      });
    }
  });

  test("distinguishes identical duplicates, conflicting duplicates, and several versions", () => {
    const source = fixture.sources[0]!;
    expect(
      resolveSourceVersion(
        [source, structuredClone(source)],
        source.source_id,
        source.document_version_id,
      ).status,
    ).toBe("ambiguous");
    expect(
      resolveSourceVersion(
        [source, { ...source, document_hash: `sha256:${"1".repeat(64)}` }],
        source.source_id,
        source.document_version_id,
      ).status,
    ).toBe("ambiguous");

    const older = { ...source, document_version_id: "ucdp.brd_codebook.v25_1" };
    expect(
      resolveSourceVersion([older, source], source.source_id, source.document_version_id).status,
    ).toBe("resolved");
    expect(resolveSourceVersion([older, source], source.source_id, "missing").status).toBe(
      "version_mismatch",
    );
  });

  test("is invariant under authority ordering for valid and invalid authority", () => {
    const malformed = { ...fixture.sources[0]!, document_hash: "bad" };
    const forward = resolveSourceVersion(
      [...authority, malformed],
      reference.source_id,
      reference.document_version_id,
    );
    const reversed = resolveSourceVersion(
      [malformed, ...authority].reverse(),
      reference.source_id,
      reference.document_version_id,
    );
    expect(reversed).toEqual(forward);
  });
});

describe("declared-reference integrity is separate from grounding and passage policy", () => {
  test("accepts a fabricated self-hashed quote and arbitrary locator by design", () => {
    const fabricatedQuote = "This text is fabricated and is not grounded by the kernel.";
    const fabricated = {
      ...reference,
      passage_id: "fabricated-but-self-consistent",
      locator: "arbitrary locator that the kernel never opens",
      quote: fabricatedQuote,
      passage_hash: sha256Utf8Text(fabricatedQuote),
    };

    // This empty result is the boundary proof: document extraction and
    // quote-at-locator grounding are separate caller obligations.
    expect(verifyEvidenceReferences([fabricated], authority)).toEqual([]);
  });

  test("reports source, version, document, passage, and structural failures", () => {
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

  test("treats throwing reference accessors as malformed without invoking them", () => {
    for (const field of [
      "source_id",
      "document_version_id",
      "passage_id",
      "locator",
      "quote",
      "passage_hash",
      "document_hash",
    ] as const) {
      const item = { ...reference };
      Object.defineProperty(item, field, {
        enumerable: true,
        get: () => {
          throw new Error(`must not invoke reference ${field}`);
        },
      });
      expect(() => verifyEvidenceReferences([item], authority)).not.toThrow();
      expect(codes(verifyEvidenceReferences([item], authority))).toEqual([
        "PROVENANCE_EVIDENCE_REFERENCE_INVALID",
      ]);
      expect(() => evidencePassageSignature(item)).toThrow(DeclaredReferenceInputError);
    }
  });

  test("does not turn an arbitrary verification array into a passage namespace", () => {
    const first = { ...fixture.references[0]!, passage_id: "passage-17" };
    const second = { ...fixture.references[1]!, passage_id: "passage-17" };
    expect(verifyEvidenceReferences([first], authority)).toEqual([]);
    expect(verifyEvidenceReferences([second], authority)).toEqual([]);
    expect(verifyEvidenceReferences([first, second], authority)).toEqual([]);

    const firstScope = [occurrence("scope-a", first, { scope: "a" })];
    const secondScope = [occurrence("scope-b", second, { scope: "b" })];
    expect(logicalPassageConflicts(firstScope)).toEqual([]);
    expect(logicalPassageConflicts(secondScope)).toEqual([]);
    expect(logicalPassageConflicts([...firstScope, ...secondScope])).toHaveLength(1);
  });

  test("is deterministic under reference and authority ordering", () => {
    const wrongHash = { ...reference, passage_hash: `sha256:${"6".repeat(64)}` };
    const missingSource = { ...fixture.references[1]!, source_id: "missing" };
    const forward = verifyEvidenceReferences([reference, wrongHash, missingSource], authority);
    const reversed = verifyEvidenceReferences(
      [missingSource, wrongHash, reference],
      [...authority].reverse(),
    );
    expect(reversed).toEqual(forward);
  });
});

describe("portable logical passage resolution", () => {
  test("resolves and conflicts independently of input order", () => {
    const identical = [
      occurrence("b", reference, { source: "b" }),
      occurrence("a", structuredClone(reference), { source: "a" }),
    ];
    expect(resolveLogicalPassage(identical, reference.passage_id).status).toBe("resolved");

    const conflicting = [
      ...identical,
      occurrence("c", { ...reference, locator: "different locator" }, { source: "c" }),
    ];
    const forward = logicalPassageConflicts(conflicting);
    const reversed = logicalPassageConflicts([...conflicting].reverse());
    expect(forward).toHaveLength(1);
    expect(reversed).toEqual(forward);
  });

  test("rejects duplicate occurrence identity without inspecting opaque context", () => {
    const duplicates = [
      occurrence("same", reference, { opaque: "first" }),
      occurrence("same", structuredClone(reference), { opaque: "second" }),
    ];
    for (const input of [duplicates, [...duplicates].reverse()]) {
      expect(() => resolveLogicalPassage(input, reference.passage_id)).toThrow(
        LogicalPassageOccurrenceError,
      );
      expect(() => logicalPassageConflicts(input)).toThrow(LogicalPassageOccurrenceError);
    }
  });
});

describe("well-formed exact identity strings", () => {
  test("rejects lone surrogates in every declared-reference identity field", () => {
    for (const field of ["source_id", "document_version_id", "passage_id", "locator"] as const) {
      expect(
        codes(verifyEvidenceReferences([{ ...reference, [field]: "bad\ud800id" }], authority)),
      ).toEqual(["PROVENANCE_EVIDENCE_REFERENCE_INVALID"]);
    }
  });

  test("rejects lone surrogates in authority and resolution identity fields", () => {
    for (const field of ["source_id", "document_version_id"] as const) {
      expect(
        resolveSourceVersion(
          [{ ...fixture.sources[0]!, [field]: "bad\udc00id" }],
          reference.source_id,
          reference.document_version_id,
        ),
      ).toEqual({ status: "invalid_authority", matches: [], invalidCount: 1 });
      expect(
        codes(verifyEvidenceReferences([], [{ ...fixture.sources[0]!, [field]: "bad\udc00id" }])),
      ).toEqual(["PROVENANCE_AUTHORITY_INVALID"]);
    }

    expect(
      resolveSourceVersion(authority, "bad\ud800source", reference.document_version_id),
    ).toEqual({
      status: "invalid_identity",
      matches: [],
      fields: ["source_id"],
    });
    expect(resolveSourceVersion(authority, reference.source_id, "bad\udc00version")).toEqual({
      status: "invalid_identity",
      matches: [],
      fields: ["document_version_id"],
    });
  });

  test("rejects lone surrogates in signatures and logical occurrence identities", () => {
    const signature = evidencePassageSignature(reference);
    for (const field of ["source_id", "document_version_id", "locator"] as const) {
      expect(() => passageSignatureKey({ ...signature, [field]: "bad\ud800id" })).toThrow(
        IllFormedUnicodeError,
      );
    }

    expect(() =>
      resolveLogicalPassage(
        [{ ...occurrence("occurrence", reference, null), passageId: "bad\ud800passage" }],
        reference.passage_id,
      ),
    ).toThrow(LogicalPassageIdentityError);
    expect(() =>
      logicalPassageConflicts([
        { ...occurrence("occurrence", reference, null), occurrenceId: "bad\udc00occurrence" },
      ]),
    ).toThrow(LogicalPassageIdentityError);
    expect(() => resolveLogicalPassage([], "bad\ud800lookup")).toThrow(LogicalPassageIdentityError);
  });

  test("preserves NFC and NFD identity spellings without normalization", () => {
    const composed = "caf\u00e9";
    const decomposed = "cafe\u0301";
    const first = { ...occurrence(composed, reference, null), passageId: composed };
    const second = { ...occurrence(decomposed, reference, null), passageId: decomposed };
    expect(resolveLogicalPassage([first, second], composed).occurrences).toEqual([first]);
    expect(resolveLogicalPassage([first, second], decomposed).occurrences).toEqual([second]);

    const samePassage = [
      occurrence(composed, reference, null),
      occurrence(decomposed, reference, null),
    ];
    expect(resolveLogicalPassage(samePassage, reference.passage_id).occurrences).toHaveLength(2);
  });
});

describe("cross-primitive identity rules", () => {
  test("canonical equivalence does not redefine sovereign external identifiers", () => {
    const composed = "caf\u00e9";
    const decomposed = "cafe\u0301";
    expect(sha256Canonical({ source_id: composed })).toBe(
      sha256Canonical({ source_id: decomposed }),
    );

    const hash = `sha256:${"a".repeat(64)}`;
    const source = { source_id: composed, document_version_id: composed, document_hash: hash };
    expect(resolveSourceVersion([source], decomposed, composed).status).toBe("missing_source");
    expect(resolveSourceVersion([source], composed, decomposed).status).toBe("version_mismatch");

    const signature = evidencePassageSignature(reference);
    expect(passageSignatureKey({ ...signature, locator: composed })).not.toBe(
      passageSignatureKey({ ...signature, locator: decomposed }),
    );
    expect(sha256Utf8Text(composed)).not.toBe(sha256Utf8Text(decomposed));
  });
});

describe("frozen Aldera-derived UCDP golden vectors", () => {
  test("pins tracked provenance and derived PDF and HTML declarations", () => {
    expect(fixture.oracle.commit).toBe("9b7d05e9fb2ed11c315e9b6a1dca66e3a8aa9eb4");
    expect(fixture.oracle.attribution).toContain("Uppsala Conflict Data Program");
    expect(fixture.oracle.license).toBe("CC BY 4.0");
    expect(fixture.oracle.untracked_artifacts).toHaveLength(2);
    expect(fixture.oracle.untracked_generated_receipt).toContain("data/local/");
    expect(fixture.sources.map(({ media_type }) => media_type)).toEqual([
      "application/pdf",
      "text/html",
    ]);
    expect(
      fixture.references.map(
        ({ source_id, document_version_id }) =>
          resolveSourceVersion(authority, source_id, document_version_id).status,
      ),
    ).toEqual(fixture.expected.source_resolution);
    expect(codes(verifyEvidenceReferences(fixture.references, authority))).toEqual(
      fixture.expected.verification_codes,
    );
    for (const item of fixture.references) {
      expect(sha256Utf8Text(item.quote)).toBe(item.passage_hash);
    }
    const occurrences = fixture.references.map((item, index) =>
      occurrence(`aldera-${index}`, item, { oracle: fixture.oracle.commit }),
    );
    expect(logicalPassageConflicts(occurrences).map(({ passageId }) => passageId)).toEqual(
      fixture.expected.combined_conflict_passage_ids,
    );
  });
});
