import _Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

import transportSchema from "../../../schemas/analysis/certificate-transport-integration-v0.1.schema.json" with { type: "json" };

import { SharedAnalysisError } from "./errors.js";
import type { CertificateTransportRecord } from "./transport-types.js";

type DefaultExport<T> = T extends { default: infer D } ? D : T;
const Ajv2020 = ((_Ajv2020 as { default?: unknown }).default ?? _Ajv2020) as DefaultExport<
  typeof _Ajv2020
>;
const validate = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true }).compile(
  transportSchema,
) as ValidateFunction<CertificateTransportRecord>;

export function assertCertificateTransportRecord(
  value: unknown,
): asserts value is CertificateTransportRecord {
  if (validate(value)) return;
  throw new SharedAnalysisError(
    "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
    "Record does not satisfy certificate-transport-integration-v0.1.schema.json.",
    {
      schema_errors: (validate.errors ?? []).map((error: ErrorObject) => ({
        instance_path: error.instancePath,
        keyword: error.keyword,
        message: error.message ?? "",
      })),
    },
  );
}
