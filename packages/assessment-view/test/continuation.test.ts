import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { sha256Canonical } from "@writ/provenance";
import { applyRequest, initialSnapshot, validateSnapshot, type Request } from "../src/contract.js";
import { receiveContinuation } from "../src/receive.js";
import { renderView } from "../src/view.js";
const packets = [0, 1, 2].map((i) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../../examples/assessments/revisable-pilot/packets/stage-${i}.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const base = initialSnapshot(packets);
function request(): Request {
  return {
    schema: "writ.experimental-continuation-request.v1",
    assessment_id: "opera-bounded-2011-2012",
    base_sha256: sha256Canonical(base),
    target: "A1",
    status: "withdrawn",
    rationale:
      "S1 and S2 require withdrawing calibration sufficiency while preserving the earlier disagreement.",
    source_ids: ["S1", "S2"],
  };
}
describe("declared continuation with preserved history", () => {
  test("receiver checks the exact delta with the producer disabled", () => {
    const r = request();
    const before = sha256Canonical(base);
    const candidate = applyRequest(base, r);
    process.env.WRIT_DISABLE_ASSESSMENT_PRODUCER = "1";
    try {
      expect(() => applyRequest(base, r)).toThrow("PRODUCER_DISABLED");
      expect(receiveContinuation(base, r, candidate).status).toBe("checked");
    } finally {
      delete process.env.WRIT_DISABLE_ASSESSMENT_PRODUCER;
    }
    expect(sha256Canonical(base)).toBe(before);
    expect(candidate.events).toHaveLength(1);
  });
  test("stale base, unsupported edits and unavailable sources reject", () => {
    for (const [mutate, code] of [
      [
        (r: Request) => {
          r.base_sha256 = "sha256:" + "0".repeat(64);
        },
        "STALE_BASE",
      ],
      [
        (r: Request) => {
          r.source_ids = ["S9"];
        },
        "SOURCE_REFERENCE_UNRESOLVED",
      ],
      [
        (r: Request) => {
          Object.assign(r, { status: "accepted_truth" });
        },
        "UNSUPPORTED_REVISION",
      ],
    ] as const) {
      const r = request();
      mutate(r);
      expect(() => applyRequest(base, r)).toThrow(code);
    }
  });
  test("source bytes, past history and altered candidate requests reject", () => {
    const broken = structuredClone(base);
    broken.packets[0]!.records[0]!.excerpt += "!";
    expect(() => validateSnapshot(broken)).toThrow("SOURCE_EXCERPT_IDENTITY");
    const r = request();
    const candidate = applyRequest(base, r);
    candidate.packets[0]!.records[1]!.text = "A rewritten earlier hypothesis";
    expect(() => receiveContinuation(base, r, candidate)).toThrow();
    const another = applyRequest(base, r);
    another.events[0]!.rationale = "Different rationale";
    expect(() => receiveContinuation(base, r, another)).toThrow("REQUEST_MISMATCH");
  });
  test("follow-up append retains earlier event and rejects replaying its stale request", () => {
    const r = request();
    const first = applyRequest(base, r);
    const second = {
      ...r,
      base_sha256: sha256Canonical(first),
      status: "contested" as const,
      rationale: "Retain a contest for substantive review.",
    };
    const result = applyRequest(first, second);
    expect(receiveContinuation(first, second, result).status).toBe("checked");
    expect(result.events[0]).toEqual(r);
    expect(() => applyRequest(first, r)).toThrow("STALE_BASE");
  });
  test("authored display rejects changed packet semantics", () => {
    const changed = structuredClone(base);
    changed.packets[0]!.records[1]!.text = "A different hypothesis";
    expect(() =>
      renderView(changed, {
        archive_base64: "e30=",
        archive_sha256: "sha256:test",
        inspection: {},
        replay: {},
      }),
    ).toThrow("UNSUPPORTED_DISPLAY_EDITION");
  });
  test("render safely embeds authored text and exposes original native bytes", () => {
    const r = request();
    r.rationale = "</script><script>alert(1)</script>";
    const revised = applyRequest(base, r);
    const html = renderView(revised, {
      archive_base64: "e30=",
      archive_sha256: "sha256:test",
      inspection: {},
      replay: {},
    });
    expect(html).not.toContain(r.rationale);
    expect(html).toContain("\\u003c/script>");
    expect(html).toContain("Export native archive");
  });
});
