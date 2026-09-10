import { sha256Canonical, sha256Utf8Text } from "@writ/provenance";

export interface Entry {
  id: string;
  kind: string;
  title: string;
  text: string;
  depends_on: string[];
  url?: string;
  date?: string;
  excerpt?: string;
  excerpt_sha256?: string;
  parent_sha256?: string;
  parent_byte_span?: number[];
  capture?: string;
}
export interface Packet {
  schema: "writ.experimental-assessment-packet.v1";
  assessment_id: string;
  question: string;
  status: string;
  stage: number;
  records: Entry[];
}
export interface Request {
  schema: "writ.experimental-continuation-request.v1";
  assessment_id: string;
  base_sha256: string;
  target: "A1";
  status: "contested" | "withdrawn" | "retained";
  rationale: string;
  source_ids: string[];
}
export interface Snapshot {
  schema: "writ.experimental-assessment-history.v1";
  packets: Packet[];
  events: Request[];
}
export class AssessmentError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export function need(ok: unknown, code: string): asserts ok {
  if (!ok) throw new AssessmentError(code);
}
function object(x: unknown): asserts x is Record<string, unknown> {
  need(x !== null && typeof x === "object" && !Array.isArray(x), "EXPECTED_OBJECT");
}
function keys(x: Record<string, unknown>, required: string[], optional: string[] = []) {
  need(
    required.every((k) => Object.hasOwn(x, k)) &&
      Object.keys(x).every((k) => [...required, ...optional].includes(k)),
    "UNEXPECTED_FIELDS",
  );
}
function text(x: unknown): asserts x is string {
  need(typeof x === "string" && x.trim().length > 0 && x.length <= 12000, "EXPECTED_TEXT");
}
function strings(x: unknown): asserts x is string[] {
  need(
    Array.isArray(x) && x.every((v) => typeof v === "string") && new Set(x).size === x.length,
    "EXPECTED_DISTINCT_STRINGS",
  );
}
const hash = /^sha256:[a-f0-9]{64}$/;
export function validatePackets(value: unknown): asserts value is Packet[] {
  need(Array.isArray(value) && value.length >= 1 && value.length <= 3, "PACKET_COUNT");
  const seen = new Set<string>();
  value.forEach((p: unknown, index: number) => {
    object(p);
    keys(p, ["schema", "assessment_id", "question", "status", "stage", "records"]);
    need(
      p.schema === "writ.experimental-assessment-packet.v1" &&
        p.assessment_id === "opera-bounded-2011-2012" &&
        p.stage === index,
      "PACKET_IDENTITY",
    );
    text(p.question);
    text(p.status);
    need(Array.isArray(p.records) && p.records.length > 0, "RECORDS_REQUIRED");
    for (const r of p.records) {
      object(r);
      keys(
        r,
        ["id", "kind", "title", "text", "depends_on"],
        [
          "url",
          "date",
          "excerpt",
          "excerpt_sha256",
          "parent_sha256",
          "parent_byte_span",
          "capture",
        ],
      );
      text(r.id);
      text(r.kind);
      text(r.title);
      text(r.text);
      strings(r.depends_on);
      need(/^[A-Z][0-9]+$/.test(r.id) && !seen.has(r.id), "RECORD_IDENTITY");
      need(
        r.depends_on.every((d) => seen.has(d)),
        "REFERENCE_UNRESOLVED",
      );
      need(
        [
          "source",
          "hypothesis",
          "assumption",
          "disagreement",
          "interpretation",
          "question",
          "boundary",
          "source_update",
          "source_correction",
        ].includes(r.kind),
        "UNSUPPORTED_KIND",
      );
      if (r.kind === "source") {
        text(r.url);
        need(new URL(r.url).protocol === "https:", "SOURCE_URL");
        text(r.date);
        text(r.excerpt);
        text(r.capture);
        text(r.parent_sha256);
        need(
          hash.test(r.parent_sha256) && r.excerpt_sha256 === sha256Utf8Text(r.excerpt),
          "SOURCE_EXCERPT_IDENTITY",
        );
        need(
          Array.isArray(r.parent_byte_span) &&
            r.parent_byte_span.length === 2 &&
            r.parent_byte_span.every((n) => Number.isSafeInteger(n) && n >= 0),
          "SOURCE_SPAN",
        );
        need(
          r.parent_byte_span[1] - r.parent_byte_span[0] ===
            new TextEncoder().encode(r.excerpt).length,
          "SOURCE_SPAN",
        );
      } else need(Object.keys(r).length === 5, "UNEXPECTED_SOURCE_METADATA");
      seen.add(r.id);
    }
  });
}
export function validateRequest(value: unknown, base: Snapshot): asserts value is Request {
  object(value);
  keys(value, [
    "schema",
    "assessment_id",
    "base_sha256",
    "target",
    "status",
    "rationale",
    "source_ids",
  ]);
  need(
    value.schema === "writ.experimental-continuation-request.v1" &&
      value.assessment_id === base.packets[0]?.assessment_id &&
      value.base_sha256 === sha256Canonical(base),
    "STALE_BASE",
  );
  need(
    value.target === "A1" && ["contested", "withdrawn", "retained"].includes(String(value.status)),
    "UNSUPPORTED_REVISION",
  );
  text(value.rationale);
  strings(value.source_ids);
  const sources = new Set(
    base.packets.flatMap((p) => p.records.filter((r) => r.kind === "source").map((r) => r.id)),
  );
  need(
    value.source_ids.length > 0 && value.source_ids.every((s) => sources.has(s)),
    "SOURCE_REFERENCE_UNRESOLVED",
  );
}
export function validateSnapshot(value: unknown): asserts value is Snapshot {
  object(value);
  keys(value, ["schema", "packets", "events"]);
  need(
    value.schema === "writ.experimental-assessment-history.v1" &&
      Array.isArray(value.events) &&
      value.events.length <= 100,
    "HISTORY_SCHEMA",
  );
  validatePackets(value.packets);
  const prefix: Snapshot = { schema: value.schema, packets: value.packets, events: [] };
  for (const event of value.events) {
    validateRequest(event, prefix);
    prefix.events.push(event);
  }
}
export function initialSnapshot(packets: unknown): Snapshot {
  validatePackets(packets);
  return structuredClone({
    schema: "writ.experimental-assessment-history.v1",
    packets,
    events: [],
  });
}
export function applyRequest(base: unknown, request: unknown): Snapshot {
  need(process.env.WRIT_DISABLE_ASSESSMENT_PRODUCER !== "1", "PRODUCER_DISABLED");
  validateSnapshot(base);
  validateRequest(request, base);
  return structuredClone({ ...base, events: [...base.events, request] });
}
