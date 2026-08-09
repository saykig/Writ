export interface WorkflowArtifactRegistration {
  workflowId: string;
  queueArtifact: string;
  queueAdapterVersion: "1.0.0";
  humanReviewAdapterVersion: "1.0.0";
}

/**
 * Explicit V1 workflow registrations. Filename shape is never used to select
 * an adapter; future workflows require their own deliberate registration.
 */
export const CURRENT_WORKFLOW_ARTIFACTS: readonly WorkflowArtifactRegistration[] = [
  {
    workflowId: "cross-family-interoperability-v1",
    queueArtifact: "docs/migrations/cross-family-interoperability/mapping-queue.yaml",
    queueAdapterVersion: "1.0.0",
    humanReviewAdapterVersion: "1.0.0",
  },
] as const;
