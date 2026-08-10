import {
  ADR_0019_WORKFLOW_ADAPTER,
  ADR_0019_WORKFLOW_ID,
  ADR_0019_WORKFLOW_VERSION,
} from "./adr-0019-workflow.js";
import {
  WorkflowArtifactAdapterRegistry,
  type WorkflowArtifactRegistration,
} from "./workflow-artifacts.js";

export const CURRENT_WORKFLOW_REGISTRATIONS: readonly WorkflowArtifactRegistration[] = [
  { workflowId: ADR_0019_WORKFLOW_ID, version: ADR_0019_WORKFLOW_VERSION },
] as const;

export const CURRENT_WORKFLOW_ADAPTERS = new WorkflowArtifactAdapterRegistry([
  ADR_0019_WORKFLOW_ADAPTER,
]);
