import {
  WorkflowArtifactAdapterRegistry,
  type WorkflowArtifactRegistration,
} from "./workflow-artifacts.js";

export const CURRENT_WORKFLOW_REGISTRATIONS: readonly WorkflowArtifactRegistration[] = [];

export const CURRENT_WORKFLOW_ADAPTERS = new WorkflowArtifactAdapterRegistry([]);
