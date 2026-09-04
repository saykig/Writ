import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { BundleCatalog, BundleCorpus, WritDataBundle } from "./contract.js";
import {
  REVIEW_ARTIFACT_BUNDLE_FORMAT_VERSION,
  WRIT_DATA_BUNDLE_FORMAT_VERSION,
} from "./contract.js";
import { hashCanonical } from "./hashing.js";
import { projectCanonicalObjects } from "./project.js";
import {
  asJsonObject,
  readNativeRepository,
  repositoryRoot,
  strings,
  text,
  type NativeRepository,
} from "./repository.js";

function gitOutput(args: readonly string[], label: string): string {
  const result = Bun.spawnSync(["git", ...args], { cwd: repositoryRoot });
  if (result.exitCode !== 0) throw new Error(`Unable to determine ${label}`);
  return result.stdout.toString().trim();
}

export function resolveCommitIdentity(commit: string, worktreeStatus: string): string {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`Invalid Writ commit identity: ${commit}`);
  if (worktreeStatus.length > 0) {
    throw new Error(
      "The Writ data bundle must be exported from a clean committed repository state",
    );
  }
  return commit;
}

function commitIdentity(): string {
  return resolveCommitIdentity(
    gitOutput(["rev-parse", "HEAD"], "the Writ commit identity"),
    gitOutput(["status", "--porcelain=v1", "--untracked-files=all"], "the Writ worktree state"),
  );
}

function licenseMetadata(): {
  softwareLicense: string | null;
  softwareLicenseFile: string | null;
  softwareLicenseText: string | null;
  copyrightNotice: string | null;
  thirdPartyNoticesFile: string | null;
  thirdPartyNoticesText: string | null;
} {
  const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
    license?: string;
  };
  const licenseFile = ["LICENSE", "LICENSE.md", "LICENSE.txt"].find((name) =>
    existsSync(join(repositoryRoot, name)),
  );
  const thirdPartyNoticesFile = [
    "THIRD_PARTY_NOTICES.md",
    "THIRD_PARTY_NOTICES.txt",
    "THIRD_PARTY_NOTICES",
  ].find((name) => existsSync(join(repositoryRoot, name)));
  const readme = readFileSync(join(repositoryRoot, "README.md"), "utf8");
  const copyrightNotice = readme
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^(?:copyright(?:\s+\(c\))?|©)\s+\d{4}(?:[-–]\d{4})?\b/i.test(line));
  return {
    softwareLicense: packageJson.license ?? null,
    softwareLicenseFile: licenseFile ?? null,
    softwareLicenseText: licenseFile
      ? readFileSync(join(repositoryRoot, licenseFile), "utf8")
      : null,
    copyrightNotice: copyrightNotice ?? null,
    thirdPartyNoticesFile: thirdPartyNoticesFile ?? null,
    thirdPartyNoticesText: thirdPartyNoticesFile
      ? readFileSync(join(repositoryRoot, thirdPartyNoticesFile), "utf8")
      : null,
  };
}

function writVersion(): string {
  const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
    version?: unknown;
  };
  if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
    throw new Error("Root package.json does not declare the Writ version");
  }
  return packageJson.version;
}

export function generateWritDataBundleForCommit(
  writCommit: string,
  repository: NativeRepository = readNativeRepository(),
): WritDataBundle {
  if (!/^[0-9a-f]{40}$/.test(writCommit)) {
    throw new Error(`Invalid Writ commit identity: ${writCommit}`);
  }
  const projected = projectCanonicalObjects(repository);
  const catalogValue = repository.catalog;
  const nativeCorpora = repository.corpora.map(({ entry }) => ({
    corpusId: entry.corpus_id,
    family: entry.family,
    jurisdiction: entry.jurisdiction,
    status: entry.status,
    path: entry.path,
    manifestPath: entry.manifest,
  }));
  const catalog: BundleCatalog = {
    source: repository.catalogSource,
    schemaVersion: text(catalogValue.schema_version, "catalog.schema_version"),
    implementedNativeFamilies: strings(
      catalogValue.implemented_native_families,
      "catalog.implemented_native_families",
    ),
    nativeCorpora,
    retiredCorpusMigrations: Array.isArray(catalogValue.retired_corpus_migrations)
      ? catalogValue.retired_corpus_migrations.map((value, index) =>
          asJsonObject(value, `catalog.retired_corpus_migrations[${index}]`),
        )
      : [],
  };
  const corpora: BundleCorpus[] = repository.corpora.map((corpus) => ({
    corpusId: corpus.entry.corpus_id,
    family: corpus.entry.family,
    jurisdiction: corpus.entry.jurisdiction,
    status: corpus.entry.status,
    path: corpus.entry.path,
    manifestPath: corpus.entry.manifest,
    canonicalIdentity: corpus.canonicalIdentity,
    recordContract: corpus.manifest.record_contract,
    manifest: asJsonObject(corpus.manifest, corpus.entry.manifest),
    manifestSource: corpus.manifestSource,
    resources: corpus.resources,
  }));
  const resources = [...repository.resources.values()];
  const sections = {
    catalog,
    corpora,
    resources,
    records: projected.records,
    recordLinks: projected.recordLinks,
    recordJudgments: projected.recordJudgments,
  };
  const sectionHashes = {
    catalog: hashCanonical(sections.catalog),
    corpora: hashCanonical(sections.corpora),
    resources: hashCanonical(sections.resources),
    records: hashCanonical(sections.records),
    recordLinks: hashCanonical(sections.recordLinks),
    recordJudgments: hashCanonical(sections.recordJudgments),
  };
  const license = licenseMetadata();
  const recordContracts = Object.fromEntries(
    [
      ...new Map(
        repository.corpora.map(({ manifest }) => [
          manifest.record_contract.id,
          manifest.record_contract.version,
        ]),
      ).entries(),
    ].sort(([left], [right]) => left.localeCompare(right)),
  );
  const metadataWithoutBundleHash = {
    bundleFormatVersion: projected.recordJudgments.some(
      (judgment) => judgment.compiledJudgment.schema_version === "0.3.0",
    )
      ? REVIEW_ARTIFACT_BUNDLE_FORMAT_VERSION
      : WRIT_DATA_BUNDLE_FORMAT_VERSION,
    writVersion: writVersion(),
    writCommit,
    repository: "https://github.com/saykig/Writ",
    ...license,
    schemaVersions: {
      corpusCatalog: catalog.schemaVersion,
      corpusManifests: [
        ...new Set(
          corpora.map((corpus) =>
            text(corpus.manifest.schema_version, `${corpus.manifestPath}.schema_version`),
          ),
        ),
      ].sort(),
      recordContracts,
    },
    sectionHashes,
  };
  const bundleHash = hashCanonical({ metadata: metadataWithoutBundleHash, ...sections });
  return { metadata: { ...metadataWithoutBundleHash, bundleHash }, ...sections };
}

/** Generate an operator-chosen snapshot only when HEAD exactly represents the working tree. */
export function generateWritDataBundle(): WritDataBundle {
  return generateWritDataBundleForCommit(commitIdentity());
}
