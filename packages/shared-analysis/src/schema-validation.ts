import _Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

import archiveSchema from "../../../schemas/analysis/shared-analysis-revision-v0.1.schema.json" with { type: "json" };

import { SharedAnalysisError } from "./errors.js";
import type { SharedAnalysisArchive } from "./types.js";

type DefaultExport<T> = T extends { default: infer D } ? D : T;
const Ajv2020 = ((_Ajv2020 as { default?: unknown }).default ?? _Ajv2020) as DefaultExport<
  typeof _Ajv2020
>;
const validate = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true }).compile(
  archiveSchema,
) as ValidateFunction<SharedAnalysisArchive>;

export function assertArchive(value: unknown): asserts value is SharedAnalysisArchive {
  if (validate(value)) return;
  throw new SharedAnalysisError(
    "SHARED_ANALYSIS_INVALID",
    "Archive does not satisfy shared-analysis-revision-v0.1.schema.json.",
    {
      schema_errors: (validate.errors ?? []).map((error: ErrorObject) => ({
        instance_path: error.instancePath,
        keyword: error.keyword,
        message: error.message ?? "",
      })),
    },
  );
}
