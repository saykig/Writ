import _Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

import episodeSchema from "../../../schemas/analysis/decision-episode-v0.1.schema.json" with { type: "json" };

import { DecisionEpisodeError } from "./episode-errors.js";
import type { DecisionEpisode } from "./episode-types.js";

type DefaultExport<T> = T extends { default: infer D } ? D : T;
const Ajv2020 = ((_Ajv2020 as { default?: unknown }).default ?? _Ajv2020) as DefaultExport<
  typeof _Ajv2020
>;
const validate = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true }).compile(
  episodeSchema,
) as ValidateFunction<DecisionEpisode>;

export function assertDecisionEpisode(value: unknown): asserts value is DecisionEpisode {
  if (validate(value)) return;
  throw new DecisionEpisodeError(
    "DECISION_EPISODE_INVALID",
    "Episode does not satisfy decision-episode-v0.1.schema.json.",
    {
      schema_errors: (validate.errors ?? []).map((error: ErrorObject) => ({
        instance_path: error.instancePath,
        keyword: error.keyword,
        message: error.message ?? "",
      })),
    },
  );
}
