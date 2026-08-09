import { describe, expect, test } from "bun:test";

import { markerLeaderStyle } from "../components/ui/wireframe-dotted-globe";

describe("wireframe dotted globe", () => {
  test("serializes marker leader styles deterministically for hydration", () => {
    const style = markerLeaderStyle([-40, -15]);

    expect(style).toEqual({
      width: "32.7200px",
      transform: "rotate(0.35877rad) translateX(10.0000px)",
    });
    expect(markerLeaderStyle([-40, -15])).toEqual(style);
  });
});
