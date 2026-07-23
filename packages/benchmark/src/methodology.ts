// The frozen methodology: the resolved AI-for-SMEs writ compiled to IR.
//
// The runner and tests use this AS-IS (`examples/2025-ai-sme-resolved.writ`).
// It is the gap/overlap-free methodology whose score program the benchmark
// reproduces; nothing here edits it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compileSource, type CompileSourceResult } from "@writ/language";
import { methodologyBundleHash } from "@writ/provenance";
import type { CanonicalIr, Commitment } from "@writ/domain";

/**
 * Absolute path to the resolved writ source (repo `examples/`). The relative
 * specifier is computed so bundlers do not asset-analyze it; Bun/Node behavior
 * is unchanged.
 */
const RESOLVED_WRIT_REL = `${"../".repeat(3)}examples/2025-ai-sme-resolved.writ`;
export const RESOLVED_WRIT_PATH = fileURLToPath(new URL(RESOLVED_WRIT_REL, import.meta.url));

let cached: CompileSourceResult | undefined;

/** Compile the resolved writ to IR (memoized, deterministic). */
export function compileResolvedWrit(): CompileSourceResult {
  if (cached === undefined) {
    const source = readFileSync(RESOLVED_WRIT_PATH, "utf8");
    cached = compileSource(source, { fileName: "2025-ai-sme-resolved.writ" });
  }
  return cached;
}

/** The compiled canonical IR; throws if compilation did not produce one. */
export function resolvedIr(): CanonicalIr {
  const result = compileResolvedWrit();
  if (result.ir === undefined) {
    throw new Error("Resolved writ failed to compile to IR.");
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
