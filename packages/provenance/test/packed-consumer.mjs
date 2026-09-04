import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execPath, stdout, version } from "node:process";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "../..");
const temporaryRoot = mkdtempSync(join(tmpdir(), "writ-provenance-consumer-"));
const consumerRoot = join(temporaryRoot, "consumer");
mkdirSync(consumerRoot);

function filesWithin(root) {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? filesWithin(path) : [path];
  });
}

function pack(destination) {
  const output = execFileSync("npm", ["pack", "--json", "--pack-destination", destination], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  return JSON.parse(output)[0];
}

const packResult = pack(temporaryRoot);
assert.equal(packResult.name, "@writ/provenance");
assert.equal(packResult.version, "0.2.0");
const packedPaths = packResult.files.map(({ path }) => path).sort();
assert.deepEqual(packedPaths, [
  "README.md",
  "dist/canonical-json.d.ts",
  "dist/canonical-json.js",
  "dist/canonical-json.js.map",
  "dist/evidence.d.ts",
  "dist/evidence.js",
  "dist/evidence.js.map",
  "dist/hash.d.ts",
  "dist/hash.js",
  "dist/hash.js.map",
  "dist/index.d.ts",
  "dist/index.js",
  "dist/index.js.map",
  "dist/repository-review-artifact.d.ts",
  "dist/repository-review-artifact.js",
  "dist/repository-review-artifact.js.map",
  "dist/review-artifact.d.ts",
  "dist/review-artifact.js",
  "dist/review-artifact.js.map",
  "package.json",
]);

const tarball = join(temporaryRoot, packResult.filename);
const secondPackRoot = mkdtempSync(join(tmpdir(), "writ-provenance-repack-"));
const secondPackResult = pack(secondPackRoot);
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
assert.equal(secondPackResult.name, packResult.name);
assert.equal(secondPackResult.version, packResult.version);
assert.equal(secondPackResult.integrity, packResult.integrity);
assert.equal(digest(join(secondPackRoot, secondPackResult.filename)), digest(tarball));

writeFileSync(
  join(temporaryRoot, "package.json"),
  JSON.stringify({ name: "writ-provenance-external-test", private: true, type: "module" }),
);
execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
  cwd: temporaryRoot,
  stdio: "pipe",
});

const installedPackage = realpathSync(join(temporaryRoot, "node_modules/@writ/provenance"));
assert.equal(installedPackage.startsWith(realpathSync(workspaceRoot)), false);
const installedManifest = JSON.parse(readFileSync(join(installedPackage, "package.json"), "utf8"));
assert.equal(installedManifest.private, true);
assert.equal(installedManifest.dependencies, undefined);
assert.equal(JSON.stringify(installedManifest).includes("workspace:"), false);

for (const path of filesWithin(installedPackage)) {
  if (!/\.(?:js|map|json|md|ts)$/.test(path)) continue;
  const text = readFileSync(path, "utf8");
  assert.equal(text.includes(workspaceRoot), false, `${path} leaks the Writ workspace path`);
  assert.equal(
    text.includes("/Users/kimchee/Documents/ChatGPT/aldera"),
    false,
    `${path} leaks Aldera's path`,
  );
  if (path.endsWith(".js")) {
    assert.equal(text.includes("@writ/domain"), false, `${path} imports @writ/domain`);
    assert.equal(
      text.includes("internal/verification/writ"),
      false,
      `${path} imports Writ internals`,
    );
  }
}

const consumerSource = `
  import assert from "node:assert/strict";
  import * as provenance from "@writ/provenance";

  const expectedExports = [
    "CanonicalJsonError",
    "DeclaredReferenceInputError",
    "IllFormedUnicodeError",
    "LogicalPassageIdentityError",
    "LogicalPassageOccurrenceError",
    "LogicalPassageSignatureError",
    "canonicalJson",
    "evidencePassageSignature",
    "logicalPassageConflicts",
    "isReviewArtifactPath",
    "passageSignatureKey",
    "resolveLogicalPassage",
    "resolveSourceVersion",
    "sha256Canonical",
    "sha256Bytes",
    "sha256Utf8Text",
    "verifyEvidenceReferences",
    "verifyReviewArtifact",
  ];
  assert.deepEqual(Object.keys(provenance).sort(), expectedExports.sort());
  assert.equal(
    provenance.sha256Canonical({ b: 1, a: 2, c: { z: [3, 2, 1], a: true }, "": 0 }),
    "sha256:bef90c20e370394ecdce81d3df174419c764d743ae35fd1d49b020388201b7b8",
  );
  const source = {
    source_id: "ucdp.brd_codebook",
    provider: "ucdp",
    document_version_id: "ucdp.brd_codebook.v26_1",
    document_hash: "sha256:b0f9162cee38358dc108c7ecf4218c7b6c121e64d456b04a9fcbf1f8414b9b75",
  };
  const quote = "exact quotation";
  const reference = {
    source_id: source.source_id,
    document_version_id: source.document_version_id,
    passage_id: "ucdp.brd_codebook.v26_1.introduction",
    locator: "pdf:3-4:Introduction",
    quote,
    passage_hash: provenance.sha256Utf8Text(quote),
    document_hash: source.document_hash,
    basis: "direct",
    role: "dependency",
  };
  assert.deepEqual(provenance.verifyEvidenceReferences([reference], [source]), []);
  const bytes = new Uint8Array([0, 255, 128]);
  const binding = { path: "review.bin", content_hash: provenance.sha256Bytes(bytes) };
  assert.equal(provenance.verifyReviewArtifact(binding, bytes).status, "verified");
  assert.equal(provenance.verifyReviewArtifact(binding).status, "unavailable");
  const repository = await import("@writ/provenance/repository");
  assert.equal(typeof repository.readRepositoryReviewArtifact, "function");
  let internalBlocked = false;
  try {
    await import("@writ/provenance/src/index.ts");
  } catch (error) {
    internalBlocked = error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED";
  }
  assert.equal(internalBlocked, true);
  process.stdout.write(JSON.stringify({ node: process.version, internalBlocked }));
`;
writeFileSync(join(consumerRoot, "consumer.mjs"), consumerSource);
const runtimeResult = JSON.parse(
  execFileSync(execPath, [join(consumerRoot, "consumer.mjs")], {
    cwd: consumerRoot,
    encoding: "utf8",
  }),
);
assert.equal(runtimeResult.node, version);
assert.equal(runtimeResult.internalBlocked, true);

const typeConsumerSource = `
  import {
    verifyEvidenceReferences,
    type DeclaredTextReference,
    type SourceVersionDeclaration,
  } from "@writ/provenance";

  const authority: SourceVersionDeclaration[] = [{
    source_id: "source",
    document_version_id: "source.v1",
    document_hash: "sha256:${"1".repeat(64)}",
  }];
  const reference: DeclaredTextReference = {
    source_id: "source",
    document_version_id: "source.v1",
    passage_id: "passage",
    locator: "section",
    quote: "quote",
    passage_hash: "sha256:${"2".repeat(64)}",
    document_hash: authority[0]!.document_hash,
  };
  verifyEvidenceReferences([reference], authority);
`;
writeFileSync(join(consumerRoot, "consumer.mts"), typeConsumerSource);
execFileSync(
  join(workspaceRoot, "node_modules/.bin/tsc"),
  [
    "--noEmit",
    "--strict",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    join(consumerRoot, "consumer.mts"),
  ],
  { cwd: consumerRoot, stdio: "pipe" },
);

stdout.write(
  `packed external consumer passed under ${version} (${packResult.filename}, ${packResult.integrity})\n`,
);
