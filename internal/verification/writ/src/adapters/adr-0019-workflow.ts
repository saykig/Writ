import { existsSync, readFileSync, realpathSync } from "node:fs";
import { relative } from "node:path";

import {
  issue,
  type CrossFamilyHumanReview,
  type CrossFamilyReviewDecision,
  type MappingQueue,
  type MappingQueueEntry,
  type RepositorySnapshot,
  type VerificationIssue,
} from "../types.js";
import {
  getWorkflowState,
  type WorkflowArtifactAdapter,
  type WorkflowArtifactLoadContext,
} from "./workflow-artifacts.js";

export const ADR_0019_WORKFLOW_ID = "cross-family-interoperability";
export const ADR_0019_WORKFLOW_VERSION = "1.0.0";
const QUEUE_ARTIFACT = "docs/migrations/cross-family-interoperability/mapping-queue.yaml";

export interface Adr0019WorkflowState {
  queues: MappingQueue[];
  humanReviews: CrossFamilyHumanReview[];
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseStructured(file: string): unknown {
  const text = readFileSync(file, "utf8");
  return file.endsWith(".json") ? JSON.parse(text) : Bun.YAML.parse(text);
}

export function parseMappingQueueFile(
  file: string,
  root: string,
): { queue?: MappingQueue; issues: VerificationIssue[] } {
  const issues: VerificationIssue[] = [];
  let value: unknown;
  try {
    value = parseStructured(file);
  } catch (error) {
    return {
      issues: [
        issue(
          "interoperability",
          "INTEROP_QUEUE_INVALID",
          `Cannot parse mapping queue: ${String(error)}`,
          { file: relative(root, file) },
        ),
      ],
    };
  }
  if (!object(value) || typeof value.schema_version !== "string") {
    return {
      issues: [
        issue(
          "interoperability",
          "INTEROP_QUEUE_INVALID",
          "Mapping queue must declare schema_version.",
          { file: relative(root, file) },
        ),
      ],
    };
  }
  if (value.schema_version !== ADR_0019_WORKFLOW_VERSION) {
    return {
      issues: [
        issue(
          "integrity",
          "VERIFIER_UNSUPPORTED_CONTRACT",
          `I recognize the ADR 0019 mapping-queue workflow identity, but I do not have verified support for declared version ${value.schema_version}.`,
          { file: relative(root, file) },
        ),
      ],
    };
  }
  if (
    !nonEmpty(value.queue_id) ||
    value.status !== "human_review_complete" ||
    !nonEmpty(value.human_review_artifact) ||
    !Array.isArray(value.active_link_ids) ||
    !value.active_link_ids.every(nonEmpty) ||
    new Set(value.active_link_ids).size !== value.active_link_ids.length ||
    !Array.isArray(value.mappings)
  ) {
    issues.push(
      issue(
        "interoperability",
        "INTEROP_QUEUE_INVALID",
        `Mapping queue is malformed for adapter version ${ADR_0019_WORKFLOW_VERSION}.`,
        { file: relative(root, file) },
      ),
    );
    return { issues };
  }
  const mappings: MappingQueueEntry[] = [];
  const mappingIds = new Set<string>();
  for (const candidate of value.mappings) {
    if (
      !object(candidate) ||
      !nonEmpty(candidate.mapping_id) ||
      (candidate.mapping_status !== "active_approved" &&
        candidate.mapping_status !== "unresolved") ||
      !(nonEmpty(candidate.legal_policy_record_id) || candidate.legal_policy_record_id === null) ||
      !nonEmpty(candidate.proposed_relation) ||
      !nonEmpty(candidate.target_institutional_id) ||
      (candidate.mapping_status === "active_approved" &&
        candidate.legal_policy_record_id === null) ||
      mappingIds.has(candidate.mapping_id)
    ) {
      issues.push(
        issue(
          "interoperability",
          "INTEROP_QUEUE_INVALID",
          `Mapping queue contains a malformed mapping for adapter version ${ADR_0019_WORKFLOW_VERSION}.`,
          { file: relative(root, file) },
        ),
      );
      continue;
    }
    mappingIds.add(candidate.mapping_id);
    mappings.push(candidate as unknown as MappingQueueEntry);
  }
  if (issues.length > 0) return { issues };
  return {
    queue: {
      schema_version: ADR_0019_WORKFLOW_VERSION,
      queue_id: value.queue_id,
      status: "human_review_complete",
      human_review_artifact: value.human_review_artifact,
      active_link_ids: value.active_link_ids as string[],
      mappings,
      file: relative(root, file),
    },
    issues: [],
  };
}

export function parseCrossFamilyHumanReviewDocument(
  value: Record<string, unknown>,
  file: string,
): { review?: CrossFamilyHumanReview; issues: VerificationIssue[] } {
  const invalid = (message: string): VerificationIssue =>
    issue("provenance", "PROVENANCE_HUMAN_REVIEW_INVALID", message, { file });
  if (!nonEmpty(value.schema_version)) {
    return { issues: [invalid("Cross-family human review must declare schema_version.")] };
  }
  if (value.schema_version !== ADR_0019_WORKFLOW_VERSION) {
    return {
      issues: [
        issue(
          "integrity",
          "VERIFIER_UNSUPPORTED_CONTRACT",
          `I recognize the ADR 0019 cross-family human-review workflow identity, but I do not have verified support for declared version ${value.schema_version}.`,
          { file },
        ),
      ],
    };
  }

  const proposalHistory = object(value.proposal_history) ? value.proposal_history : undefined;
  const revision = object(value.approved_id_revision) ? value.approved_id_revision : undefined;
  if (
    !nonEmpty(value.review_id) ||
    !nonEmpty(value.reviewer) ||
    value.review_type !== "human" ||
    value.status !== "complete" ||
    !proposalHistory ||
    !nonEmpty(proposalHistory.proposer) ||
    proposalHistory.proposed_link_review_state !== "draft" ||
    proposalHistory.proposed_judgment_status !== "proposed" ||
    proposalHistory.preserved_as !== "superseded_judgments" ||
    !revision ||
    !nonEmpty(revision.previous_approved_id) ||
    !nonEmpty(revision.active_id) ||
    revision.decision !== "approve" ||
    !Array.isArray(value.decisions)
  ) {
    return {
      issues: [
        invalid(
          `Cross-family human review is malformed for adapter version ${ADR_0019_WORKFLOW_VERSION}.`,
        ),
      ],
    };
  }

  const decisions: CrossFamilyReviewDecision[] = [];
  const linkIds = new Set<string>();
  const acceptedJudgmentIds = new Set<string>();
  const proposalJudgmentIds = new Set<string>();
  for (const [index, candidate] of value.decisions.entries()) {
    if (
      !object(candidate) ||
      !nonEmpty(candidate.link_id) ||
      candidate.decision !== "approve" ||
      candidate.final_review_state !== "approved" ||
      !nonEmpty(candidate.reviewer) ||
      !nonEmpty(candidate.proposal_judgment_id) ||
      !nonEmpty(candidate.accepted_judgment_id) ||
      linkIds.has(candidate.link_id) ||
      acceptedJudgmentIds.has(candidate.accepted_judgment_id) ||
      proposalJudgmentIds.has(candidate.proposal_judgment_id)
    ) {
      return {
        issues: [
          invalid(
            `Cross-family human review decision[${index}] is malformed or duplicates a reviewed identifier.`,
          ),
        ],
      };
    }
    linkIds.add(candidate.link_id);
    acceptedJudgmentIds.add(candidate.accepted_judgment_id);
    proposalJudgmentIds.add(candidate.proposal_judgment_id);
    decisions.push({
      link_id: candidate.link_id,
      decision: "approve",
      final_review_state: "approved",
      reviewer: candidate.reviewer,
      proposal_judgment_id: candidate.proposal_judgment_id,
      accepted_judgment_id: candidate.accepted_judgment_id,
    });
  }

  return {
    review: {
      schema_version: ADR_0019_WORKFLOW_VERSION,
      review_id: value.review_id,
      reviewer: value.reviewer,
      status: "complete",
      proposal_proposer: proposalHistory.proposer,
      proposed_link_review_state: "draft",
      proposed_judgment_status: "proposed",
      proposal_preserved_as: "superseded_judgments",
      approved_id_revision: {
        previous_id: revision.previous_approved_id,
        active_id: revision.active_id,
        decision: "approve",
      },
      decisions,
      file,
    },
    issues: [],
  };
}

function loadAdr0019Workflow(context: WorkflowArtifactLoadContext): {
  state?: Adr0019WorkflowState;
  issues: VerificationIssue[];
} {
  const { root, resolvePath } = context;
  const issues: VerificationIssue[] = [];
  const queueRoute = resolvePath(QUEUE_ARTIFACT);
  if (!queueRoute.ok || !existsSync(queueRoute.absolute)) {
    return {
      issues: [
        issue(
          "integrity",
          "INTEGRITY_ROUTED_FILE_MISSING",
          `Registered workflow artifact does not resolve inside the verification workspace: ${QUEUE_ARTIFACT}`,
          { file: QUEUE_ARTIFACT },
        ),
      ],
    };
  }
  const parsed = parseMappingQueueFile(queueRoute.absolute, root);
  issues.push(...parsed.issues);
  if (!parsed.queue) return { issues };

  const humanReviews: CrossFamilyHumanReview[] = [];
  const reviewRoute = resolvePath(parsed.queue.human_review_artifact);
  if (!reviewRoute.ok || !existsSync(reviewRoute.absolute)) {
    issues.push(
      issue(
        "provenance",
        "PROVENANCE_HUMAN_REVIEW_INVALID",
        `Queue human-review artifact does not resolve inside the verification workspace: ${parsed.queue.human_review_artifact}`,
        { file: parsed.queue.file },
      ),
    );
    return { state: { queues: [parsed.queue], humanReviews }, issues };
  }
  const reviewFile = realpathSync(reviewRoute.absolute);
  let value: unknown;
  try {
    value = parseStructured(reviewFile);
  } catch (error) {
    issues.push(
      issue(
        "provenance",
        "PROVENANCE_HUMAN_REVIEW_INVALID",
        `Cannot parse cross-family human review: ${String(error)}`,
        { file: reviewRoute.relative },
      ),
    );
    return { state: { queues: [parsed.queue], humanReviews }, issues };
  }
  if (!object(value)) {
    issues.push(
      issue(
        "provenance",
        "PROVENANCE_HUMAN_REVIEW_INVALID",
        "Cross-family human review must contain an object.",
        { file: reviewRoute.relative },
      ),
    );
    return { state: { queues: [parsed.queue], humanReviews }, issues };
  }
  const review = parseCrossFamilyHumanReviewDocument(value, reviewRoute.relative);
  issues.push(...review.issues);
  if (review.review) humanReviews.push(review.review);
  return { state: { queues: [parsed.queue], humanReviews }, issues };
}

export const ADR_0019_WORKFLOW_ADAPTER: WorkflowArtifactAdapter<Adr0019WorkflowState> = {
  workflowId: ADR_0019_WORKFLOW_ID,
  version: ADR_0019_WORKFLOW_VERSION,
  load: (context) => loadAdr0019Workflow(context),
};

export function getAdr0019WorkflowState(
  snapshot: Pick<RepositorySnapshot, "workflowStates">,
): Adr0019WorkflowState {
  return (
    getWorkflowState<Adr0019WorkflowState>(
      snapshot.workflowStates,
      ADR_0019_WORKFLOW_ID,
      ADR_0019_WORKFLOW_VERSION,
    ) ?? { queues: [], humanReviews: [] }
  );
}
