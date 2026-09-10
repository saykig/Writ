import _Ajv2020 from "ajv/dist/2020.js";
import {
  exactJsonBytes,
  exactJsonKey,
  verifyEncodedBytes,
  type EncodedBytes,
} from "@writ/decision-case";
import { sha256Bytes } from "@writ/provenance";
import schema from "../../../schemas/analysis/external-simulation-v0.1.schema.json" with { type: "json" };
import profile from "./simpy-profile.json" with { type: "json" };

type DefaultExport<T> = T extends { default: infer D } ? D : T;
const Ajv2020 = ((_Ajv2020 as { default?: unknown }).default ?? _Ajv2020) as DefaultExport<
  typeof _Ajv2020
>;
const ajv = new Ajv2020({ strict: true, allErrors: true });
const validate = ajv.compile<ExternalSimulationRun>(schema);
const validateInput = ajv.compile<ResourceInput>(schema.$defs.input);
const validateOutput = ajv.compile<ResourceOutput>(schema.$defs.output);

export class ExternalSimulationError extends Error {
  constructor(
    readonly code:
      | "EXTERNAL_SIMULATION_INVALID"
      | "EXTERNAL_SIMULATION_BINDING_MISMATCH"
      | "EXTERNAL_SIMULATION_TRACE_REJECTED",
    message: string,
  ) {
    super(message);
    this.name = "ExternalSimulationError";
  }
}

export interface ExternalSimulationRun {
  readonly schema_version: "0.1.0";
  readonly artifact_kind: "external_simulation_run";
  readonly profile: "simpy-resource-fifo.v1";
  readonly evidence_kind: "model_generated";
  readonly claim: "finite_trace_under_supplied_inputs";
  readonly package: {
    readonly name: "simpy";
    readonly version: "4.1.1";
    readonly sdist_sha256: string;
    readonly source_manifest: Readonly<Record<string, string>>;
  };
  readonly model: EncodedBytes;
  readonly upstream_example_sha256: string;
  readonly inputs: EncodedBytes;
  readonly output: EncodedBytes;
  readonly assumptions: readonly string[];
  readonly runtime: {
    readonly implementation: "CPython";
    readonly version: "3.13.15";
    readonly randomness: "none";
    readonly time_arithmetic: "integer";
  };
}
export interface ResourceInput {
  readonly arrivals: readonly string[];
  readonly service_minutes: string;
  readonly unit: "minute";
}
interface ResourceOutput {
  readonly unit: "minute";
  readonly rows: readonly {
    readonly car: string;
    readonly arrival: string;
    readonly start: string;
    readonly finish: string;
  }[];
}

function reject(message: string): never {
  throw new ExternalSimulationError("EXTERNAL_SIMULATION_BINDING_MISMATCH", message);
}
function parse(raw: Uint8Array): unknown {
  try {
    if (raw.length === 0 || raw.length > 1024 * 1024) throw new Error("size");
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
    if (!Buffer.from(exactJsonBytes(value)).equals(Buffer.from(raw))) throw new Error("exact JSON");
    return value;
  } catch {
    throw new ExternalSimulationError(
      "EXTERNAL_SIMULATION_INVALID",
      "Expected bounded deterministic UTF-8 exact JSON.",
    );
  }
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

/** Pure receiving: never imports SimPy or executes the embedded model. */
export function receiveExternalSimulation(
  raw: Uint8Array,
  expected: { readonly runSha256: string; readonly inputSha256: string },
) {
  if (sha256Bytes(raw) !== expected.runSha256)
    reject("Run differs from independently supplied expected identity.");
  const value = parse(raw);
  if (!validate(value))
    throw new ExternalSimulationError(
      "EXTERNAL_SIMULATION_INVALID",
      "Unsupported simulation envelope or claim.",
    );
  const run = value as ExternalSimulationRun;
  if (
    run.inputs.sha256 !== expected.inputSha256 ||
    run.model.sha256 !== profile.model_sha256 ||
    run.package.sdist_sha256 !== profile.sdist_sha256 ||
    run.upstream_example_sha256 !== profile.upstream_example_sha256 ||
    exactJsonKey(run.package.source_manifest) !== exactJsonKey(profile.source_manifest) ||
    exactJsonKey(run.assumptions) !== exactJsonKey(profile.assumptions)
  )
    reject("Wrong model, source, package, inputs or assumptions for this profile.");
  let inputs: unknown;
  let output: unknown;
  try {
    verifyEncodedBytes(run.model, "model");
    inputs = parse(verifyEncodedBytes(run.inputs, "inputs"));
    output = parse(verifyEncodedBytes(run.output, "output"));
  } catch (error) {
    if (error instanceof ExternalSimulationError) throw error;
    reject("Embedded simulation bytes do not match their identities.");
  }
  if (!validateInput(inputs) || !validateOutput(output))
    throw new ExternalSimulationError(
      "EXTERNAL_SIMULATION_INVALID",
      "Unsupported inputs or trace format.",
    );
  const input = inputs as ResourceInput;
  const trace = output as ResourceOutput;
  const arrivals = input.arrivals.map(BigInt);
  if (arrivals.some((time, index) => index > 0 && time <= arrivals[index - 1]!))
    throw new ExternalSimulationError(
      "EXTERNAL_SIMULATION_INVALID",
      "This profile requires strictly increasing arrivals.",
    );
  const service = BigInt(input.service_minutes);
  const finishes: bigint[] = [];
  let totalWait = 0n;
  // Equal service + FIFO => departure order follows arrival order. For two servers,
  // job i can start at max(arrival_i, departure_(i-2)); this is an independent
  // recurrence, not an event simulator or imported producer implementation.
  if (trace.rows.length !== arrivals.length)
    throw new ExternalSimulationError("EXTERNAL_SIMULATION_TRACE_REJECTED", "Incomplete trace.");
  for (const [i, arrival] of arrivals.entries()) {
    const available = i < 2 ? 0n : finishes[i - 2]!;
    const start = arrival > available ? arrival : available;
    const finish = start + service;
    const row = trace.rows[i]!;
    if (
      row.car !== String(i) ||
      row.arrival !== String(arrival) ||
      row.start !== String(start) ||
      row.finish !== String(finish)
    )
      throw new ExternalSimulationError(
        "EXTERNAL_SIMULATION_TRACE_REJECTED",
        "Trace violates the declared two-server FIFO recurrence.",
      );
    finishes.push(finish);
    totalWait += start - arrival;
  }
  return freeze({
    run_sha256: sha256Bytes(raw),
    input_sha256: run.inputs.sha256,
    output_sha256: run.output.sha256,
    value: run,
    input,
    trace,
    numerical_check: "exact_integer_fifo_trace" as const,
    total_wait: { value: String(totalWait), unit: "minute" as const },
    assurance: {
      artifact_integrity: true,
      supported_format: true,
      analytical_trace_agreement: true,
      producer_execution_authenticated: false,
      model_empirically_validated: false,
      bellman_certificate: false,
      causal_result: false,
    },
  });
}
