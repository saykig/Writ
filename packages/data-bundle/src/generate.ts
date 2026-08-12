import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { BundleCatalog, BundleCorpus, WritDataBundle } from "./contract.js";
import { WRIT_DATA_BUNDLE_FORMAT_VERSION } from "./contract.js";
import { hashCanonical } from "./hashing.js";
import { projectCanonicalObjects } from "./project.js";
import { asJsonObject, readNativeRepository, repositoryRoot, strings, text } from "./repository.js";

function commitIdentity(): string {
  const result = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: repositoryRoot });
  if (result.exitCode !== 0) throw new Error("Unable to determine the Writ commit identity");
  const commit = result.stdout.toString().trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`Invalid Writ commit identity: ${commit}`);
  return commit;
}

function licenseMetadata(): {
  softwareLicense: string | null;
  softwareLicenseFile: string | null;
  copyrightNotice: string | null;
} {
  const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
    license?: string;
  };
  const licenseFile = ["LICENSE", "LICENSE.md", "LICENSE.txt"].find((name) =>
    existsSync(join(repositoryRoot, name)),
  );
  const noticeFile = ["NOTICE", "NOTICE.md", "NOTICE.txt"].find((name) =>
    existsSync(join(repositoryRoot, name)),
  );
  return {
    softwareLicense: packageJson.license ?? null,
    softwareLicenseFile: licenseFile ?? null,
    copyrightNotice: noticeFile
      ? readFileSync(join(repositoryRoot, noticeFile), "utf8").trim()
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

export function generateWritDataBundle(): WritDataBundle {
  const repository = readNativeRepository();
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
    bundleFormatVersion: WRIT_DATA_BUNDLE_FORMAT_VERSION,
    writVersion: writVersion(),
    writCommit: commitIdentity(),
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
