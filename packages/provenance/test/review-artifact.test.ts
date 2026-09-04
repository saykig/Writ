import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isReviewArtifactPath, sha256Bytes, verifyReviewArtifact } from "../src/index.js";
import { readRepositoryReviewArtifact } from "../src/repository-review-artifact.js";

const bytes = new TextEncoder().encode("Human disposition: approve the bounded statement.\n");
const binding = { path: "reviews/decision.yaml", content_hash: sha256Bytes(bytes) };
const context = { judgmentPath: "corpora/test/judgments.writ" };
const codes = (value: { diagnostics: { code: string }[] }): string[] =>
  value.diagnostics.map(({ code }) => code);

describe("exact review-artifact content association", () => {
  test("exact bytes verify; a declaration without bytes is unavailable", () => {
    expect(verifyReviewArtifact(binding, bytes)).toEqual({
      status: "verified",
      binding,
      diagnostics: [],
    });
    expect(verifyReviewArtifact(binding).status).toBe("unavailable");
    expect(codes(verifyReviewArtifact(binding))).toEqual([
      "PROVENANCE_REVIEW_ARTIFACT_BYTES_UNAVAILABLE",
    ]);
    const changed = new TextEncoder().encode("Human disposition: withdraw the statement.\n");
    expect(codes(verifyReviewArtifact(binding, changed))).toEqual([
      "PROVENANCE_REVIEW_ARTIFACT_HASH_MISMATCH",
    ]);
  });

  test("raw bytes preserve line endings, invalid UTF-8, Unicode spelling and empty content", () => {
    expect(() => sha256Bytes("text" as unknown as Uint8Array)).toThrow(TypeError);
    const variants = [
      new TextEncoder().encode("café\n"),
      new TextEncoder().encode("cafe\u0301\n"),
      new TextEncoder().encode("café\r\n"),
      new Uint8Array([0xff, 0x00, 0x80]),
      new Uint8Array(),
    ];
    expect(new Set(variants.map(sha256Bytes)).size).toBe(variants.length);
    for (const content of variants) {
      expect(
        verifyReviewArtifact({ ...binding, content_hash: sha256Bytes(content) }, content).status,
      ).toBe("verified");
    }
    expect(sha256Bytes(new Uint8Array())).toBe(
      "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  test("one exact binding rejects malformed, duplicate and accessor-backed representations", () => {
    let invoked = false;
    const accessor = {
      content_hash: binding.content_hash,
      get path() {
        invoked = true;
        return binding.path;
      },
    };
    for (const candidate of [
      null,
      [],
      [binding, { ...binding, content_hash: `sha256:${"0".repeat(64)}` }],
      {},
      { ...binding, extra: true },
      accessor,
    ]) {
      expect(codes(verifyReviewArtifact(candidate, bytes))).toEqual([
        "PROVENANCE_REVIEW_ARTIFACT_BINDING_INVALID",
      ]);
    }
    expect(invoked).toBe(false);
    for (const content_hash of [
      binding.content_hash.toUpperCase(),
      binding.content_hash + "\n",
      `sha512:${"0".repeat(64)}`,
      "sha256:abc",
      "",
      "sha256:" + "G".repeat(64),
    ]) {
      expect(codes(verifyReviewArtifact({ ...binding, content_hash }, bytes))).toEqual([
        "PROVENANCE_REVIEW_ARTIFACT_HASH_INVALID",
      ]);
    }
    expect(codes(verifyReviewArtifact(binding, "text" as unknown as Uint8Array))).toEqual([
      "PROVENANCE_REVIEW_ARTIFACT_BYTES_INVALID",
    ]);
    const proxy = new Proxy(bytes, {});
    expect(codes(verifyReviewArtifact(binding, proxy))).toEqual([
      "PROVENANCE_REVIEW_ARTIFACT_BYTES_INVALID",
    ]);
    expect(() => sha256Bytes(proxy)).toThrow("Exact byte hashing requires Uint8Array.");
  });

  test("locator aliases fail rather than normalize", () => {
    for (const path of [
      "",
      "/tmp/a",
      "../a",
      "a/../b",
      "./a",
      "a/./b",
      "a//b",
      "a/",
      "a\\b",
      "C:/a",
      "file:a",
      "%2e%2e/a",
      "a\0b",
      "a\nb",
      "\ud800",
    ]) {
      expect(isReviewArtifactPath(path)).toBe(false);
      expect(codes(verifyReviewArtifact({ ...binding, path }, bytes))).toEqual([
        "PROVENANCE_REVIEW_ARTIFACT_PATH_INVALID",
      ]);
    }
  });

  test("another exact artifact may verify without proving its author or semantic agreement", () => {
    for (const content of [
      "This is an extraction report, not a human disposition.",
      "Reviewer label: invented person. I reject the proposition.",
      "Evidence is insufficient and the reviewer is mistaken.",
    ]) {
      const supplied = new TextEncoder().encode(content);
      expect(
        verifyReviewArtifact(
          { path: "another/review.json", content_hash: sha256Bytes(supplied) },
          supplied,
        ).status,
      ).toBe("verified");
    }
  });
});

describe("governed repository artifact resolution", () => {
  function withRepository(run: (root: string, outside: string) => void): void {
    const parent = mkdtempSync(join(tmpdir(), "writ-review-artifact-"));
    const root = join(parent, "repository");
    mkdirSync(join(root, "reviews"), { recursive: true });
    writeFileSync(join(root, binding.path), bytes);
    const outside = join(parent, "outside.yaml");
    writeFileSync(outside, bytes);
    try {
      run(root, outside);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }

  test("unrelated changes are harmless, substitution and wrong hashes fail, and copies preserve locator identity", () => {
    withRepository((root) => {
      expect(readRepositoryReviewArtifact(root, binding, context).status).toBe("verified");
      writeFileSync(join(root, "unrelated.txt"), "Unrelated change");
      expect(readRepositoryReviewArtifact(root, binding, context).status).toBe("verified");
      writeFileSync(join(root, "reviews/copy.yaml"), bytes);
      const copy = readRepositoryReviewArtifact(
        root,
        { ...binding, path: "reviews/copy.yaml" },
        context,
      );
      expect(copy.status).toBe("verified");
      if (copy.status === "verified") expect(copy.binding.path).toBe("reviews/copy.yaml");
      expect(
        codes(
          readRepositoryReviewArtifact(
            root,
            { ...binding, content_hash: `sha256:${"0".repeat(64)}` },
            context,
          ),
        ),
      ).toEqual(["PROVENANCE_REVIEW_ARTIFACT_HASH_MISMATCH"]);
      writeFileSync(join(root, binding.path), "Human disposition: withdraw.");
      expect(codes(readRepositoryReviewArtifact(root, binding, context))).toEqual([
        "PROVENANCE_REVIEW_ARTIFACT_HASH_MISMATCH",
      ]);
    });
  });

  test("missing files, directories, traversal, absolute paths and symlink aliases fail closed", () => {
    withRepository((root, outside) => {
      for (const path of ["reviews/missing.yaml", "missing/review.yaml"]) {
        expect(codes(readRepositoryReviewArtifact(root, { ...binding, path }, context))).toEqual([
          "PROVENANCE_REVIEW_ARTIFACT_NOT_FOUND",
        ]);
      }
      expect(
        codes(readRepositoryReviewArtifact(root, { ...binding, path: "reviews" }, context)),
      ).toEqual(["PROVENANCE_REVIEW_ARTIFACT_NOT_REGULAR_FILE"]);
      for (const path of ["../outside.yaml", outside]) {
        expect(codes(readRepositoryReviewArtifact(root, { ...binding, path }, context))).toEqual([
          "PROVENANCE_REVIEW_ARTIFACT_PATH_INVALID",
        ]);
      }
      symlinkSync(outside, join(root, "reviews/outside.yaml"));
      symlinkSync(join(root, binding.path), join(root, "reviews/inside.yaml"));
      symlinkSync(join(root, "reviews"), join(root, "alias"));
      for (const path of ["reviews/outside.yaml", "reviews/inside.yaml", "alias/decision.yaml"]) {
        expect(codes(readRepositoryReviewArtifact(root, { ...binding, path }, context))).toEqual([
          "PROVENANCE_REVIEW_ARTIFACT_PATH_ALIAS",
        ]);
      }
    });
  });

  test("self-reference is a repository context check; an empty regular file is verifiable content", () => {
    withRepository((root) => {
      expect(
        codes(readRepositoryReviewArtifact(root, binding, { judgmentPath: binding.path })),
      ).toEqual(["PROVENANCE_REVIEW_ARTIFACT_SELF_REFERENCE"]);
      writeFileSync(join(root, "reviews/empty"), new Uint8Array());
      expect(
        readRepositoryReviewArtifact(
          root,
          { path: "reviews/empty", content_hash: sha256Bytes(new Uint8Array()) },
          context,
        ).status,
      ).toBe("verified");
    });
  });
});
