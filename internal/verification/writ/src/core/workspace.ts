import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { repositoryRoot } from "../repository.js";

export interface VerificationWorkspace {
  /** Absolute filesystem/worktree root. */
  root: string;
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
