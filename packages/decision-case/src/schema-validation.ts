import _Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

import caseSchema from "../../../schemas/analysis/decision-case-v0.1.schema.json" with { type: "json" };
import executionSchema from "../../../schemas/analysis/decision-execution-v0.1.schema.json" with { type: "json" };

import { DecisionCaseError } from "./errors.js";
import type { DecisionCase, DecisionExecution } from "./types.js";

type DefaultExport<T> = T extends { default: infer D } ? D : T;
const Ajv2020 = ((_Ajv2020 as { default?: unknown }).default ?? _Ajv2020) as DefaultExport<
  typeof _Ajv2020
>;

const MAX_ENVELOPE_BYTES = 8 * 1024 * 1024;
const MAX_JSON_DEPTH = 64;
const NUMBER = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;

/** Validate raw JSON structure before JSON.parse can collapse duplicate object keys. */
class JsonStructureScanner {
  private index = 0;

  constructor(
    private readonly text: string,
    private readonly field: string,
  ) {}

  scan(): void {
    this.value(0);
    this.whitespace();
    if (this.index !== this.text.length) this.fail("has trailing content");
  }

  private value(depth: number): void {
    this.whitespace();
    if (depth > MAX_JSON_DEPTH) this.fail(`exceeds maximum depth ${MAX_JSON_DEPTH}`);
    const token = this.text[this.index];
    if (token === "{") return this.object(depth + 1);
    if (token === "[") return this.array(depth + 1);
    if (token === '"') {
      this.string();
      return;
    }
    for (const literal of ["true", "false", "null"]) {
      if (this.text.startsWith(literal, this.index)) {
        this.index += literal.length;
        return;
      }
    }
    NUMBER.lastIndex = this.index;
    const match = NUMBER.exec(this.text);
    if (match !== null) {
      this.index = NUMBER.lastIndex;
      return;
    }
    this.fail("contains invalid JSON syntax");
  }

  private object(depth: number): void {
    if (depth > MAX_JSON_DEPTH) this.fail(`exceeds maximum depth ${MAX_JSON_DEPTH}`);
    this.index += 1;
    this.whitespace();
    if (this.take("}")) return;
    const keys = new Set<string>();
    while (true) {
      this.whitespace();
      if (this.text[this.index] !== '"') this.fail("contains a non-string object key");
      const key = this.string();
      if (keys.has(key)) this.fail(`contains duplicate object key ${JSON.stringify(key)}`);
      keys.add(key);
      this.whitespace();
      if (!this.take(":")) this.fail("is missing an object-key colon");
      this.value(depth);
      this.whitespace();
      if (this.take("}")) return;
      if (!this.take(",")) this.fail("contains an invalid object separator");
    }
  }

  private array(depth: number): void {
    if (depth > MAX_JSON_DEPTH) this.fail(`exceeds maximum depth ${MAX_JSON_DEPTH}`);
    this.index += 1;
    this.whitespace();
    if (this.take("]")) return;
    while (true) {
      this.value(depth);
      this.whitespace();
      if (this.take("]")) return;
      if (!this.take(",")) this.fail("contains an invalid array separator");
    }
  }

  private string(): string {
    const start = this.index;
    this.index += 1;
    while (this.index < this.text.length) {
      const code = this.text.charCodeAt(this.index);
      if (code < 0x20) this.fail("contains an unescaped control character");
      const token = this.text[this.index]!;
      if (token === '"') {
        this.index += 1;
        try {
          return JSON.parse(this.text.slice(start, this.index)) as string;
        } catch {
          this.fail("contains an invalid JSON string");
        }
      }
      if (token === "\\") {
        this.index += 1;
        const escape = this.text[this.index];
        if (escape === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(this.text.slice(this.index + 1, this.index + 5))) {
            this.fail("contains an invalid Unicode escape");
          }
          this.index += 5;
          continue;
        }
        if (escape === undefined || !'"\\/bfnrt'.includes(escape)) {
          this.fail("contains an invalid string escape");
        }
      }
      this.index += 1;
    }
    this.fail("contains an unterminated JSON string");
  }

  private whitespace(): void {
    while (/\s/.test(this.text[this.index] ?? "") && this.index < this.text.length) {
      this.index += 1;
    }
  }

  private take(token: string): boolean {
    if (this.text[this.index] !== token) return false;
    this.index += 1;
    return true;
  }

  private fail(reason: string): never {
    throw new DecisionCaseError(
      "DECISION_CASE_INVALID",
      `${this.field} ${reason} at character ${this.index}.`,
    );
  }
}

export function parseGovernedJson(raw: Uint8Array, field: string): unknown {
  if (raw.length === 0 || raw.length > MAX_ENVELOPE_BYTES) {
    throw new DecisionCaseError(
      "DECISION_CASE_INVALID",
      `${field} must contain 1 to ${MAX_ENVELOPE_BYTES} bytes.`,
    );
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    throw new DecisionCaseError("DECISION_CASE_INVALID", `${field} is not valid UTF-8 JSON.`);
  }
  new JsonStructureScanner(text, field).scan();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DecisionCaseError("DECISION_CASE_INVALID", `${field} is not valid UTF-8 JSON.`);
  }
}

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true });
const caseValidator = ajv.compile(caseSchema) as ValidateFunction<DecisionCase>;
const executionValidator = ajv.compile(executionSchema) as ValidateFunction<DecisionExecution>;

function schemaDetail(errors: readonly ErrorObject[] | null | undefined): Record<string, unknown> {
  return {
    schema_errors: (errors ?? []).map((error) => ({
      instance_path: error.instancePath,
      keyword: error.keyword,
      message: error.message ?? "",
      params: error.params as Record<string, unknown>,
    })),
  };
}

export function assertDecisionCaseSchema(value: unknown): asserts value is DecisionCase {
  if (!caseValidator(value)) {
    throw new DecisionCaseError(
      "DECISION_CASE_INVALID",
      "Decision case does not satisfy decision-case-v0.1.schema.json.",
      schemaDetail(caseValidator.errors),
    );
  }
}

export function assertDecisionExecutionSchema(value: unknown): asserts value is DecisionExecution {
  if (!executionValidator(value)) {
    throw new DecisionCaseError(
      "DECISION_CASE_INVALID",
      "Decision execution does not satisfy decision-execution-v0.1.schema.json.",
      schemaDetail(executionValidator.errors),
    );
  }
}
