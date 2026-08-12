import { issue, type VerificationIssue, type WorkflowStateEnvelope } from "../types.js";
import { resolveWorkspacePath, type WorkspacePathResolution } from "../core/workspace.js";

export interface WorkflowArtifactRegistration {
  workflowId: string;
  version: string;
}

export interface WorkflowArtifactLoadContext {
  root: string;
  resolvePath(...metadataPaths: string[]): WorkspacePathResolution;
}

export interface WorkflowArtifactLoadResult<TState = unknown> {
  state?: TState;
  issues: VerificationIssue[];
}

export interface WorkflowArtifactAdapter<TState = unknown> {
  workflowId: string;
  version: string;
  load(context: WorkflowArtifactLoadContext): WorkflowArtifactLoadResult<TState>;
}

function adapterKey(workflowId: string, version: string): string {
  return `${workflowId}\0${version}`;
}

/** Exact workflow capability registry. It defines harness support, not Writ ontology. */
export class WorkflowArtifactAdapterRegistry {
  readonly #adapters = new Map<string, WorkflowArtifactAdapter>();

  constructor(adapters: readonly WorkflowArtifactAdapter[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: WorkflowArtifactAdapter): void {
    const key = adapterKey(adapter.workflowId, adapter.version);
    if (this.#adapters.has(key)) {
      throw new Error(
        `Duplicate workflow adapter registration: ${adapter.workflowId}@${adapter.version}`,
      );
    }
    this.#adapters.set(key, adapter);
  }

  resolve(workflowId: string, version: string): WorkflowArtifactAdapter | undefined {
    return this.#adapters.get(adapterKey(workflowId, version));
  }
}

export interface WorkflowDiscoveryResult {
  workflowStates: Record<string, WorkflowStateEnvelope>;
  issues: VerificationIssue[];
}

/**
 * Generic workflow socket. Adding a workflow changes only the registration and
 * adapter set; discovery never interprets an artifact or state shape itself.
 */
export function discoverWorkflowArtifacts(
  root: string,
  registrations: readonly WorkflowArtifactRegistration[],
  adapters: WorkflowArtifactAdapterRegistry,
): WorkflowDiscoveryResult {
  const workflowStates: Record<string, WorkflowStateEnvelope> = {};
  const issues: VerificationIssue[] = [];
  for (const registration of registrations) {
    const adapter = adapters.resolve(registration.workflowId, registration.version);
    if (!adapter) {
      issues.push(
        issue(
          "integrity",
          "VERIFIER_UNSUPPORTED_CONTRACT",
          `I recognize workflow ${registration.workflowId}, but I do not have verified support for exact adapter version ${registration.version}.`,
        ),
      );
      continue;
    }
    const loaded = adapter.load({
      root,
      resolvePath: (...metadataPaths) => resolveWorkspacePath(root, ...metadataPaths),
    });
    issues.push(...loaded.issues);
    if (loaded.state !== undefined) {
      workflowStates[registration.workflowId] = {
        workflow_id: registration.workflowId,
        adapter_version: registration.version,
        state: loaded.state,
      };
    }
  }
  return { workflowStates, issues };
}

export function getWorkflowState<TState>(
  workflowStates: Readonly<Record<string, WorkflowStateEnvelope>>,
  workflowId: string,
  exactVersion: string,
): TState | undefined {
  const loaded = workflowStates[workflowId];
  return loaded?.adapter_version === exactVersion ? (loaded.state as TState) : undefined;
}
