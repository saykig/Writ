import type { EncodedBytes } from "@writ/decision-case";

import type { CertificateTransportReplay, TransportEngineOptions } from "./transport-types.js";
import type {
  AnalysisAddress,
  DependencyAddress,
  RecipientReplay,
  SourceIdentity,
} from "./types.js";

export const DECISION_EPISODE_SCHEMA_VERSION = "0.1.0" as const;
export const DECISION_EPISODE_KIND = "decision_episode" as const;

export interface EpisodeActor {
  readonly actor_type: "human" | "institution";
  readonly actor_id: string;
}

export interface DecisionEpisodeCheckedHistory {
  readonly binding_sha256: string;
  readonly certificate_transport_record: EncodedBytes;
  readonly certificate_transport_record_sha256: string;
  readonly shared_analysis_sha256: string;
  readonly revision_id: string;
  readonly analysis: AnalysisAddress;
  readonly applicability_assessment_id: string;
  readonly reassessment_basis_sha256: string;
  readonly revision_impact_sha256: string;
  readonly source_bindings: readonly SourceIdentity[];
  readonly assumption_dependencies: readonly DependencyAddress[];
  readonly target_problem_sha256: string;
  readonly target_query_sha256: string;
  readonly prior_execution_sha256: string;
  readonly successor_execution_sha256: string;
  readonly source_certificate_sha256: string;
  readonly target_certificate_sha256: string;
}

export interface EpisodeAuthorityBasis {
  readonly authority_basis_id: string;
  readonly authority_holder: EpisodeActor;
  readonly basis_statement: string;
  readonly artifact: EncodedBytes;
  readonly verification_status: "supplied_not_verified_by_writ";
}

export interface EpisodeHumanDecision {
  readonly decision_id: string;
  readonly decided_by: EpisodeActor;
  readonly decided_at: string;
  readonly selected_action: string;
  readonly rationale: string;
  readonly authority_basis_id: string;
  readonly considered_analysis_binding_sha256: string;
  readonly mathematical_role: "considered_not_authorizing";
}

export interface EpisodeImplementation {
  readonly implementation_id: string;
  readonly decision_id: string;
  readonly implemented_by: EpisodeActor;
  readonly implemented_at: string;
  readonly implemented_action: string;
  readonly description: string;
  readonly record: EncodedBytes;
}

export interface EpisodeObservation {
  readonly observation_id: string;
  readonly implementation_id: string;
  readonly observed_by: EpisodeActor;
  readonly observed_at: string;
  readonly description: string;
  readonly record: EncodedBytes;
}

export interface EpisodeInterpretation {
  readonly interpretation_id: string;
  readonly observation_id: string;
  readonly kind: "causal_attribution" | "decision_evaluation" | "model_update_proposal";
  readonly statement: string;
  readonly review: {
    readonly status: "unreviewed" | "accepted" | "rejected" | "contested";
    readonly reviewer: EpisodeActor | null;
    readonly rationale: string | null;
  };
}

export interface EpisodeReconsideration {
  readonly reconsideration_id: string;
  readonly observation_id: string;
  readonly declared_by: EpisodeActor;
  readonly declared_at: string;
  readonly status: "reconsideration_required";
  readonly rationale: string;
  readonly interpretation_ids: readonly string[];
  readonly model_effect: "none_automatic";
  readonly next_step: "human_review";
}

export interface DecisionEpisode {
  readonly schema_version: typeof DECISION_EPISODE_SCHEMA_VERSION;
  readonly episode_kind: typeof DECISION_EPISODE_KIND;
  readonly episode_id: string;
  readonly checked_history: DecisionEpisodeCheckedHistory;
  readonly authority_basis: EpisodeAuthorityBasis;
  readonly human_decision: EpisodeHumanDecision;
  readonly implementation: EpisodeImplementation;
  readonly observation: EpisodeObservation;
  readonly interpretations: readonly EpisodeInterpretation[];
  readonly reconsideration: EpisodeReconsideration;
}

export interface DecisionEpisodeDeclaration {
  readonly episode_id: string;
  readonly authority_basis: EpisodeAuthorityBasis;
  readonly human_decision: Omit<EpisodeHumanDecision, "considered_analysis_binding_sha256">;
  readonly implementation: EpisodeImplementation;
  readonly observation: EpisodeObservation;
  readonly interpretations: readonly EpisodeInterpretation[];
  readonly reconsideration: EpisodeReconsideration;
}

export interface LoadedDecisionEpisode {
  readonly value: DecisionEpisode;
  readonly episode_sha256: string;
}

export interface DecisionEpisodeReplay {
  readonly episode_sha256: string;
  readonly checked_history_binding_sha256: string;
  readonly fresh_checks: {
    readonly shared_analysis: RecipientReplay;
    readonly certificate_transport: CertificateTransportReplay;
  };
  readonly preserved_declarations: {
    readonly authority_basis_sha256: string;
    readonly human_decision_sha256: string;
    readonly implementation_sha256: string;
    readonly observation_sha256: string;
    readonly interpretation_sha256s: readonly {
      readonly interpretation_id: string;
      readonly sha256: string;
      readonly review_status: EpisodeInterpretation["review"]["status"];
    }[];
    readonly reconsideration_sha256: string;
  };
  readonly automatic_inferences: {
    readonly decision_from_mathematics: false;
    readonly causality_from_observation: false;
    readonly decision_correctness_from_observation: false;
    readonly model_update_from_observation: false;
  };
}

export type DecisionEpisodeReplayOptions = TransportEngineOptions & {
  /** Obtained independently of the received file; a hash is identity, not actor authentication. */
  readonly expectedEpisodeSha256: string;
};
