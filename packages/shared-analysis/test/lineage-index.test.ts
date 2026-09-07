import { describe, expect, test } from "bun:test";

import { SharedAnalysisError } from "../src/errors.js";
import { ScopedLineageIndex } from "../src/lineage-index.js";

describe("adapted scoped lineage index", () => {
  test("reconstructs every distinct deterministic path", () => {
    const index = new ScopedLineageIndex();
    for (const id of ["source", "left", "right", "subject", "checked"]) {
      index.addNode(id, { id });
    }
    index.addEdge("source", "left");
    index.addEdge("source", "right");
    index.addEdge("left", "subject");
    index.addEdge("right", "subject");
    index.addEdge("subject", "checked");
    index.assertAcyclic();

    expect(index.paths("source", "checked")).toEqual([
      ["source", "left", "subject", "checked"],
      ["source", "right", "subject", "checked"],
    ]);
  });

  test("fails closed on a dependency cycle", () => {
    const index = new ScopedLineageIndex();
    index.addNode("a", { id: "a" });
    index.addNode("b", { id: "b" });
    index.addEdge("a", "b");
    index.addEdge("b", "a");

    expect(() => index.assertAcyclic()).toThrow(SharedAnalysisError);
    try {
      index.assertAcyclic();
    } catch (error) {
      expect((error as SharedAnalysisError).code).toBe("SHARED_ANALYSIS_DEPENDENCY_CYCLE");
    }
  });
});
