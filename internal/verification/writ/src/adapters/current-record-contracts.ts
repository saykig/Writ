import type { AuthorityIndex } from "../authority.js";
import {
  ExactContractAdapterRegistry,
  type ExactContractAdapter,
} from "../core/adapter-registry.js";

export type CurrentRecordAdapterKind =
  "current_native_core" | "frozen_compiled_compatibility" | "reviewed_compatibility_document";

export interface CurrentRecordContractCapabilities {
  adapterKind: CurrentRecordAdapterKind;
  expectedFamily: "institutional" | "legal_policy";
  manifestKind: "native" | "compatibility";
  verifiesCoreProvenance: boolean;
}

export interface CurrentRecordAdapterInput {
  family: string;
  value: unknown;
}

export interface CurrentRecordAdapterOutput {
  family: string;
  value: unknown;
  capabilities: CurrentRecordContractCapabilities;
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
  capabilities: CurrentRecordContractCapabilities,
): ExactContractAdapter<CurrentRecordAdapterInput, CurrentRecordAdapterOutput> {
  return {
    contractId,
    declaredVersion,
    adapt: ({ family, value }) => ({ family, value, capabilities }),
  };
}

export const CURRENT_RECORD_ADAPTERS = new ExactContractAdapterRegistry<
  CurrentRecordAdapterInput,
  CurrentRecordAdapterOutput
>([
  adapter(INSTITUTIONAL_RECORD_SCHEMA, "0.2.0", {
    adapterKind: "current_native_core",
    expectedFamily: "institutional",
    manifestKind: "native",
    verifiesCoreProvenance: true,
  }),
  adapter(LEGAL_POLICY_RECORD_SCHEMA, "0.2.0", {
    adapterKind: "current_native_core",
    expectedFamily: "legal_policy",
    manifestKind: "native",
    verifiesCoreProvenance: true,
  }),
  adapter(LEGACY_LEGAL_POLICY_RECORD_SCHEMA, "0.1.0", {
    adapterKind: "frozen_compiled_compatibility",
    expectedFamily: "legal_policy",
    manifestKind: "compatibility",
    verifiesCoreProvenance: false,
  }),
  adapter(REVIEWED_DOCUMENT_SCHEMA, "1.0.0", {
    adapterKind: "reviewed_compatibility_document",
    expectedFamily: "legal_policy",
    manifestKind: "compatibility",
    verifiesCoreProvenance: false,
  }),
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
