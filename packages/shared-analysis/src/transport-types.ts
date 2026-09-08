import type { EncodedBytes } from "@writ/decision-case";

import type { AnalysisAddress } from "./types.js";

export const CERTIFICATE_TRANSPORT_RECORD_SCHEMA_VERSION = "0.1.0" as const;
export const CERTIFICATE_TRANSPORT_RECORD_KIND = "certificate_transport_integration" as const;
export const DECISION_LAB_TRANSPORT_COMMIT =
  "e5f77dfcf929708951f4673b3f394461ef09c752" as const;
export const DECISION_LAB_TRANSPORT_INTERFACE = "certificate-transport-request.v1" as const;
export const DECISION_LAB_TRANSPORT_GUARANTEE =
  "expected-additive-total-cost-regret" as const;

export interface TransportDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface TransportCheckProjection {
  readonly schema: "certificate-transport-check.v1";
  readonly status: "checked" | "rejected" | "checker_error";
  readonly request_sha256: string;
  readonly evidence_sha256: string;
  readonly target_certificate_status: "checked" | "rejected" | "not_checked";
  readonly transport_status: "checked" | "rejected" | "not_checked";
  readonly warrant: string | null;
  readonly bounds: Readonly<Record<string, string>> | null;
  readonly diagnostics: readonly TransportDiagnostic[];
  readonly limits: readonly string[];
}

export interface TransportEngineOptions {
  readonly engineRoot: string;
  readonly pythonExecutable?: string;
}

export interface CertificateTransportModelBinding {
  readonly changed_request_fields: readonly string[];
  readonly rationale: string;
}

export interface CertificateTransportRevisionBinding {
  readonly shared_analysis_sha256: string;
  readonly revision_id: string;
  readonly analysis: AnalysisAddress;
  readonly applicability_assessment_id: string;
  readonly reassessment_basis_sha256: string;
  readonly revision_impact_sha256: string;
  readonly prior_analysis_sha256: string;
  readonly target_analysis_sha256: string;
}

export interface CertificateTransportRecord {
  readonly schema_version: typeof CERTIFICATE_TRANSPORT_RECORD_SCHEMA_VERSION;
  readonly record_kind: typeof CERTIFICATE_TRANSPORT_RECORD_KIND;
  readonly decision_lab: {
    readonly commit: typeof DECISION_LAB_TRANSPORT_COMMIT;
    readonly interface: typeof DECISION_LAB_TRANSPORT_INTERFACE;
    readonly guarantee: typeof DECISION_LAB_TRANSPORT_GUARANTEE;
  };
  readonly binding: CertificateTransportRevisionBinding;
  readonly model_binding: CertificateTransportModelBinding;
  readonly shared_analysis: EncodedBytes;
  readonly request: EncodedBytes;
  readonly evidence: EncodedBytes;
  readonly producer_check: EncodedBytes;
}

export interface LoadedCertificateTransportRecord {
  readonly value: CertificateTransportRecord;
  readonly record_sha256: string;
}

export interface CertificateTransportReplay {
  readonly record_sha256: string;
  readonly shared_analysis_sha256: string;
  readonly revision_id: string;
  readonly analysis: AnalysisAddress;
  readonly revision_impact_sha256: string;
  readonly reassessment_basis_sha256: string;
  readonly historical_source_guarantee_preserved: true;
  readonly fresh_check_matches_producer_check: boolean;
  readonly target_certificate_status: TransportCheckProjection["target_certificate_status"];
  readonly transport_status: TransportCheckProjection["transport_status"];
  readonly mathematical_status: TransportCheckProjection["status"];
  readonly bounds: Readonly<Record<string, string>> | null;
}
