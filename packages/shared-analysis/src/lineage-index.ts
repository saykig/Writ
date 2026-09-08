import { exactJsonKey } from "@writ/decision-case";
import { sha256Canonical } from "@writ/provenance";

import { SharedAnalysisError } from "./errors.js";

/**
 * Deterministic graph mechanics adapted from Aldera's `src/lineage-graph.ts` at
 * 9b7d05e9fb2ed11c315e9b6a1dca66e3a8aa9eb4 (Apache-2.0).
 *
 * Aldera builds an entity/activity dataset-construction graph. This narrower Writ adaptation keeps
 * only the reusable mechanisms: content-conflict detection for duplicate node IDs, lexical
 * traversal, all distinct paths, and explicit cycle failure. Nodes here are scoped decision-case
 * dependencies; the graph is a rebuildable index and is never portable authority.
 */
export class ScopedLineageIndex {
  readonly #nodes = new Map<string, string>();
  readonly #outgoing = new Map<string, Set<string>>();

  addNode(id: string, declaration: unknown): void {
    const fingerprint = sha256Canonical(declaration);
    const prior = this.#nodes.get(id);
    if (prior !== undefined && prior !== fingerprint) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_REVISION_INVALID",
        `Lineage node ${id} has conflicting declarations.`,
      );
    }
    this.#nodes.set(id, fingerprint);
    if (!this.#outgoing.has(id)) this.#outgoing.set(id, new Set());
  }

  addEdge(from: string, to: string): void {
    if (!this.#nodes.has(from) || !this.#nodes.has(to)) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_REVISION_INVALID",
        `Lineage edge ${from} -> ${to} names an undeclared node.`,
      );
    }
    this.#outgoing.get(from)!.add(to);
  }

  assertAcyclic(): void {
    const visited = new Set<string>();
    const active = new Set<string>();
    const visit = (node: string): void => {
      if (active.has(node)) {
        throw new SharedAnalysisError(
          "SHARED_ANALYSIS_DEPENDENCY_CYCLE",
          `Dependency lineage contains a cycle at ${node}.`,
        );
      }
      if (visited.has(node)) return;
      active.add(node);
      for (const next of [...(this.#outgoing.get(node) ?? [])].sort()) visit(next);
      active.delete(node);
      visited.add(node);
    };
    for (const node of [...this.#nodes.keys()].sort()) visit(node);
  }

  paths(from: string, to: string): string[][] {
    if (!this.#nodes.has(from) || !this.#nodes.has(to)) return [];
    const paths: string[][] = [];
    const walk = (node: string, path: string[], active: Set<string>): void => {
      if (node === to) {
        paths.push(path);
        return;
      }
      for (const next of [...(this.#outgoing.get(node) ?? [])].sort()) {
        if (active.has(next)) {
          throw new SharedAnalysisError(
            "SHARED_ANALYSIS_DEPENDENCY_CYCLE",
            `Dependency lineage contains a cycle at ${next}.`,
          );
        }
        walk(next, [...path, next], new Set([...active, next]));
      }
    };
    walk(from, [from], new Set([from]));
    const unique = new Map(paths.map((path) => [exactJsonKey(path), path]));
    return [...unique.values()].sort((left, right) => {
      const leftKey = exactJsonKey(left);
      const rightKey = exactJsonKey(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
  }

  reaches(from: string, to: string): boolean {
    return this.paths(from, to).length > 0;
  }
}
