import { spawnSync } from "node:child_process";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

import {
  verifyReviewArtifact,
  type ReviewArtifactBinding,
  type ReviewArtifactDiagnostic,
  type ReviewArtifactDiagnosticCode,
} from "./review-artifact.js";

export type RepositoryReviewArtifactResult =
  | {
      status: "verified";
      binding: ReviewArtifactBinding;
      bytes: Uint8Array;
      diagnostics: [];
    }
  | { status: "invalid"; diagnostics: ReviewArtifactDiagnostic[] };

function invalid(
  code: ReviewArtifactDiagnosticCode,
  message: string,
): RepositoryReviewArtifactResult {
  return { status: "invalid", diagnostics: [{ code, message }] };
}

/**
 * Explicit read-only filesystem adapter shared by repository verification and
 * export. The selected root is the whole governed location. Every path segment
 * must use its exact stored spelling and must not be a symlink. The artifact must
 * be tracked in the selected repository's Git index. The caller names
 * the judgment's containing source to exclude self-referential hashing.
 */
export function readRepositoryReviewArtifact(
  root: string,
  input: unknown,
  options: { judgmentPath: string },
): RepositoryReviewArtifactResult {
  const declaration = verifyReviewArtifact(input);
  if (declaration.status === "invalid") return declaration;
  const binding = declaration.binding;
  if (binding.path === options.judgmentPath) {
    return invalid(
      "PROVENANCE_REVIEW_ARTIFACT_SELF_REFERENCE",
      "A review artifact cannot be the source containing its own judgment binding.",
    );
  }
  let descriptor: number | undefined;
  try {
    const physicalRoot = realpathSync(root);
    let physical = physicalRoot;
    const segments = binding.path.split("/");
    for (const [index, segment] of segments.entries()) {
      const exactEntry = readdirSync(physical).includes(segment);
      const next = join(physical, segment);
      const metadata = lstatSync(next);
      if (!exactEntry || metadata.isSymbolicLink()) {
        return invalid(
          "PROVENANCE_REVIEW_ARTIFACT_PATH_ALIAS",
          "Review artifact paths must use exact directory entries and contain no symlinks.",
        );
      }
      if (index < segments.length - 1 && !metadata.isDirectory()) {
        return invalid(
          "PROVENANCE_REVIEW_ARTIFACT_NOT_REGULAR_FILE",
          "Review artifact parent path is not a directory.",
        );
      }
      if (index === segments.length - 1 && !metadata.isFile()) {
        return invalid(
          "PROVENANCE_REVIEW_ARTIFACT_NOT_REGULAR_FILE",
          "Review artifact must be a regular file.",
        );
      }
      physical = next;
    }
    const resolved = realpathSync(physical);
    const resolvedPath = relative(physicalRoot, resolved).split(sep).join("/");
    if (isAbsolute(resolvedPath) || resolvedPath !== binding.path) {
      return invalid(
        "PROVENANCE_REVIEW_ARTIFACT_PATH_ALIAS",
        "Review artifact path does not resolve to its exact governed repository location.",
      );
    }
    const tracked = spawnSync(
      "git",
      [
        "--literal-pathspecs",
        "-C",
        physicalRoot,
        "ls-files",
        "-z",
        "--error-unmatch",
        "--",
        binding.path,
      ],
      { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } },
    );
    if (tracked.error || (tracked.status !== 0 && tracked.status !== 1)) {
      return invalid(
        "PROVENANCE_REVIEW_ARTIFACT_INVENTORY_UNAVAILABLE",
        "The selected repository's Git tracked-file inventory could not be read.",
      );
    }
    if (tracked.status !== 0 || tracked.stdout !== `${binding.path}\0`) {
      return invalid(
        "PROVENANCE_REVIEW_ARTIFACT_NOT_TRACKED",
        "Review artifact must be an exact tracked file in the selected repository's Git index.",
      );
    }
    descriptor = openSync(physical, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!fstatSync(descriptor).isFile()) {
      return invalid(
        "PROVENANCE_REVIEW_ARTIFACT_NOT_REGULAR_FILE",
        "Review artifact must be a regular file.",
      );
    }
    const bytes = new Uint8Array(readFileSync(descriptor));
    const verification = verifyReviewArtifact(binding, bytes);
    return verification.status === "verified"
      ? { ...verification, bytes }
      : { status: "invalid", diagnostics: verification.diagnostics };
  } catch (error) {
    const code = error !== null && typeof error === "object" && "code" in error ? error.code : "";
    return invalid(
      code === "ENOENT" || code === "ENOTDIR"
        ? "PROVENANCE_REVIEW_ARTIFACT_NOT_FOUND"
        : "PROVENANCE_REVIEW_ARTIFACT_READ_FAILED",
      code === "ENOENT" || code === "ENOTDIR"
        ? "Declared review artifact does not exist at its governed repository path."
        : "Declared review artifact could not be read from its governed repository path.",
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
