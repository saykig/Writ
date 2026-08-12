import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

export interface VerificationWorkspace {
  /** Absolute filesystem/worktree root. */
  root: string;
}

export function repositoryRoot(from: string = import.meta.dir): string {
  let cursor = resolve(from);
  while (true) {
    if (existsSync(join(cursor, "AGENTS.md")) && existsSync(join(cursor, "schemas"))) return cursor;
    const parent = resolve(cursor, "..");
    if (parent === cursor || isAbsolute(cursor) === false)
      throw new Error("Cannot locate Writ repository root");
    cursor = parent;
  }
}

export type WorkspacePathResolution =
  { ok: true; absolute: string; relative: string } | { ok: false; requested: string };

/**
 * Resolve a metadata-declared route without allowing it to leave the selected
 * verification workspace. Relative `..` segments are permitted only when the
 * fully resolved route remains inside the workspace.
 */
export function resolveWorkspacePath(
  workspaceRoot: string,
  ...metadataPaths: string[]
): WorkspacePathResolution {
  const root = resolve(workspaceRoot);
  const requested = metadataPaths.join("/");
  if (metadataPaths.some((candidate) => isAbsolute(candidate))) {
    return { ok: false, requested };
  }
  const absolute = resolve(root, ...metadataPaths);
  const label = relative(root, absolute);
  if (label === ".." || label.startsWith("../") || isAbsolute(label)) {
    return { ok: false, requested };
  }
  if (existsSync(absolute)) {
    try {
      const physicalRoot = realpathSync(root);
      const physical = realpathSync(absolute);
      const physicalLabel = relative(physicalRoot, physical);
      if (physicalLabel === ".." || physicalLabel.startsWith("../") || isAbsolute(physicalLabel)) {
        return { ok: false, requested };
      }
    } catch {
      return { ok: false, requested };
    }
  }
  return { ok: true, absolute, relative: label || "." };
}

/**
 * Select an existing filesystem/worktree as verification input.
 * The harness does not create, clean or mutate this workspace.
 */
export function verificationWorkspace(root: string = repositoryRoot()): VerificationWorkspace {
  const absolute = resolve(root);
  for (const required of ["schemas", "corpora"]) {
    if (!existsSync(resolve(absolute, required))) {
      throw new Error(`Verification workspace is missing ${required}/: ${absolute}`);
    }
  }
  return { root: absolute };
}
