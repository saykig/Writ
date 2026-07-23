// The frozen methodology: the resolved AI-for-SMEs covenant compiled to IR.
//
// The runner and tests use this AS-IS (`examples/2025-ai-sme-resolved.covenant`).
// It is the gap/overlap-free methodology whose score program the benchmark
// reproduces; nothing here edits it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compileSource, type CompileSourceResult } from "@covenant/language";
import { methodologyBundleHash } from "@covenant/provenance";
import type { CanonicalIr, Commitment } from "@covenant/domain";

/**
 * Absolute path to the resolved covenant source (repo `examples/`). The relative
 * specifier is computed so bundlers do not asset-analyze it; Bun/Node behavior
 * is unchanged.
 */
const RESOLVED_COVENANT_REL = `${"../".repeat(3)}examples/2025-ai-sme-resolved.covenant`;
export const RESOLVED_COVENANT_PATH = fileURLToPath(
  new URL(RESOLVED_COVENANT_REL, import.meta.url),
);

let cached: CompileSourceResult | undefined;

/** Compile the resolved covenant to IR (memoized, deterministic). */
export function compileResolvedCovenant(): CompileSourceResult {
  if (cached === undefined) {
    const source = readFileSync(RESOLVED_COVENANT_PATH, "utf8");
    cached = compileSource(source, { fileName: "2025-ai-sme-resolved.covenant" });
  }
  return cached;
}

/** The compiled canonical IR; throws if compilation did not produce one. */
export function resolvedIr(): CanonicalIr {
  const result = compileResolvedCovenant();
  if (result.ir === undefined) {
    throw new Error("Resolved covenant failed to compile to IR.");
  }
  return result.ir;
}

/** The single commitment the benchmark scores. */
export function resolvedCommitment(): Commitment {
  const ir = resolvedIr();
  const commitment = ir.commitments[0];
  if (commitment === undefined) {
    throw new Error("Resolved IR declares no commitments.");
  }
  return commitment;
}

/** `sha256:` content hash of the compiled methodology bundle. */
export function resolvedBundleHash(): string {
  return methodologyBundleHash(resolvedIr());
}

/** `<package>@<version>` identity, e.g. `g7.kananaskis_2025.ai_sme.resolved@1.0.0`. */
export function methodologyVersionId(): string {
  const ir = resolvedIr();
  return `${ir.package.name}@${ir.package.version}`;
}
