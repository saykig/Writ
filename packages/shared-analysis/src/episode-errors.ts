export type DecisionEpisodeDiagnosticCode =
  | "DECISION_EPISODE_INVALID"
  | "DECISION_EPISODE_BINDING_MISMATCH"
  | "DECISION_EPISODE_SEQUENCE_INVALID"
  | "DECISION_EPISODE_REPLAY_INCOMPLETE";

export class DecisionEpisodeError extends Error {
  constructor(
    readonly code: DecisionEpisodeDiagnosticCode,
    message: string,
    readonly detail?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "DecisionEpisodeError";
  }
}
