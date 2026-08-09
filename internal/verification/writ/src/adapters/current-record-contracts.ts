import type { AuthorityIndex } from "../authority.js";
import {
  ExactContractAdapterRegistry,
  type ExactContractAdapter,
} from "../core/adapter-registry.js";

export type CurrentRecordAdapterKind = "compiled_native" | "reviewed_compatibility_document";

export interface CurrentRecordAdapterInput {
  family: string;
  value: unknown;
}

export interface CurrentRecordAdapterOutput {
  family: string;
  value: unknown;
  adapterKind: CurrentRecordAdapterKind;
}

export const INSTITUTIONAL_RECORD_SCHEMA =
  "https://writ.example/schemas/extensions/institutional-record.schema.json";
export const LEGAL_POLICY_RECORD_SCHEMA =
  "https://writ.example/schemas/extensions/legal-policy-record.schema.json";
export const LEGACY_LEGAL_POLICY_RECORD_SCHEMA =
  "https://writ.example/schemas/compatibility/record-grammar-v0.1/legal-policy-record.schema.json";
export const REVIEWED_DOCUMENT_SCHEMA =
  "https://writ.example/schemas/compatibility/eu-us-ai-reviewed-v1/reviewed-corpus-document.schema.json";

function adapter(
  contractId: string,
  declaredVersion: string,
  adapterKind: CurrentRecordAdapterKind,
): ExactContractAdapter<CurrentRecordAdapterInput, CurrentRecordAdapterOutput> {
  return {
    contractId,
    declaredVersion,
    adapt: ({ family, value }) => ({ family, value, adapterKind }),
  };
}

export const CURRENT_RECORD_ADAPTERS = new ExactContractAdapterRegistry<
  CurrentRecordAdapterInput,
  CurrentRecordAdapterOutput
>([
  adapter(INSTITUTIONAL_RECORD_SCHEMA, "0.2.0", "compiled_native"),
  adapter(LEGAL_POLICY_RECORD_SCHEMA, "0.2.0", "compiled_native"),
  adapter(LEGACY_LEGAL_POLICY_RECORD_SCHEMA, "0.1.0", "compiled_native"),
  adapter(REVIEWED_DOCUMENT_SCHEMA, "1.0.0", "reviewed_compatibility_document"),
]);

export type ContractSupport = "invalid" | "supported" | "unsupported";

export function classifyRecordContract(
  authority: AuthorityIndex,
  id: string,
  exactVersion: string,
): ContractSupport {
  if (!authority.schemas.has(id)) return "invalid";
  return CURRENT_RECORD_ADAPTERS.resolve(id, exactVersion) ? "supported" : "unsupported";
}
