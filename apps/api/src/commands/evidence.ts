// DATA-002 — evidence command API (the write model).
//
// These are COMMANDS, not CRUD: `createClaim` / `createAction` mint candidates,
// and the reviewed transitions (`submit` / `accept` / `reject` / `contest` /
// `supersede`) move evidence through its lifecycle. Every command:
//   * runs under an authenticated actor with a role check (RBAC);
//   * enforces separation of duties (an actor cannot accept what it authored or
//     submitted — no self-approval);
//   * honours an optional expected-version guard (optimistic concurrency → 409);
//   * emits exactly one immutable audit event on success.
//
// Candidates are the only thing creation produces: models and importers create
// candidates, never accepted records (AGENTS.md invariant 4). Accepted records
// are superseded, never edited in place (invariant 7) — `supersede` closes the
// prior row and inserts a replacement in one repository transaction.

import { sha256Canonical } from "@writ/provenance";
import type { DbClient } from "../db/client.js";
import { createRepositories, type Repositories } from "../db/repositories/index.js";
import { withTransaction } from "../db/repositories/shared.js";
import type {
  ActionInput,
  ActionRow,
  ClaimInput,
  ClaimRow,
  EvidenceStance,
  JsonObject,
  SupportType,
  TruthValue,
} from "../db/types.js";
import type { Actor, Role } from "../http/auth.js";
import { hasAnyRole } from "../http/auth.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../http/errors.js";
import { appendAuditEvent } from "./audit.js";

/** The ambient inputs shared by every command: a db handle and the actor. */
export interface CommandContext {
  readonly client: DbClient;
  readonly actor: Actor;
}

/** A versioned handle onto an object; the `version` is the optimistic-concurrency token. */
export interface CommandResult {
  readonly id: string;
  readonly object_type: "claim" | "action";
  readonly status: string;
  readonly logical_id?: string;
  readonly version: string;
  readonly event: "created" | "submitted" | "accepted" | "rejected" | "contested" | "superseded";
  readonly replacement_id?: string;
}

// --- Version tokens (optimistic concurrency) --------------------------------

interface Versionable {
  readonly id: string;
  readonly status: string;
  readonly system_from: Date;
  readonly system_to: Date | null;
}

function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/**
 * The optimistic-concurrency token for a row. It changes whenever the row's
 * status changes (accept/reject/contest) and whenever supersession replaces the
 * open row with a new id, so a caller holding a stale token is reliably rejected.
 */
export function versionToken(row: Versionable): string {
  return sha256Canonical({
    id: row.id,
    status: row.status,
    system_from: iso(row.system_from),
    system_to: iso(row.system_to),
  });
}

/** Reject the write when the caller's expected version no longer matches. */
function assertExpectedVersion(row: Versionable, expected: string | undefined): void {
  if (expected !== undefined && expected !== versionToken(row)) {
    throw new ConflictError(
      "version_conflict",
      "the object was modified since the expected version; re-read and retry",
      { object_id: row.id, expected, actual: versionToken(row) },
    );
  }
}

// --- RBAC -------------------------------------------------------------------

function requireRole(actor: Actor, roles: Role[]): void {
  if (!hasAnyRole(actor, ...roles)) {
    throw new ForbiddenError("forbidden_role", `role ${roles.join("|")} required`, {
      actor_roles: actor.roles,
    });
  }
}

/**
 * Separation of duties: whoever accepts (or otherwise decides) an object must
 * not be one of the actors that authored or submitted it. The author/submitter
 * set is reconstructed from the immutable audit trail, so it holds for both
 * claims and actions without a dedicated column.
 */
async function assertNoSelfApproval(
  repos: Repositories,
  objectType: "claim" | "action",
  objectId: string,
  actor: Actor,
): Promise<void> {
  const events = await repos.audit.listForObject(objectType, objectId);
  const originators = new Set(
    events
      .filter((e) => e.event_type.endsWith(".created") || e.event_type.endsWith(".submitted"))
      .map((e) => e.actor_id),
  );
  if (originators.has(actor.id)) {
    throw new ForbiddenError(
      "self_approval",
      "separation of duties: the author/submitter of evidence may not review it",
      { object_type: objectType, object_id: objectId, actor_id: actor.id },
    );
  }
}

// --- Small typed body extractors --------------------------------------------

type Body = Record<string, unknown>;

function str(body: Body, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`field "${key}" is required and must be a non-empty string`);
  }
  return value;
}

function optStr(body: Body, key: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ValidationError(`field "${key}" must be a string`);
  }
  return value;
}

function strArray(body: Body, key: string, minItems: number): string[] {
  const value = body[key];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new ValidationError(`field "${key}" must be an array of strings`);
  }
  if (value.length < minItems) {
    throw new ValidationError(`field "${key}" must have at least ${minItems} item(s)`);
  }
  return value as string[];
}

function obj(body: Body, key: string): JsonObject | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`field "${key}" must be an object`);
  }
  return value as JsonObject;
}

const TRUTH_VALUES = new Set<TruthValue>(["true", "false", "unknown", "contested"]);
function truthValue(body: Body): TruthValue {
  const value = str(body, "truth_value");
  if (!TRUTH_VALUES.has(value as TruthValue)) {
    throw new ValidationError(`truth_value must be one of ${[...TRUTH_VALUES].join(", ")}`);
  }
  return value as TruthValue;
}

interface EvidenceLinkBody {
  passage_id: string;
  stance: EvidenceStance;
  support_type: SupportType;
}

function evidenceLinks(body: Body): EvidenceLinkBody[] {
  const value = body.evidence_links;
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ValidationError(`field "evidence_links" must be an array`);
  }
  return value.map((raw) => {
    const link = raw as Body;
    return {
      passage_id: str(link, "passage_id"),
      stance: str(link, "stance") as EvidenceStance,
      support_type: str(link, "support_type") as SupportType,
    };
  });
}

// --- Response mapping --------------------------------------------------------

function claimResult(row: ClaimRow, event: CommandResult["event"]): CommandResult {
  return {
    id: row.id,
    object_type: "claim",
    status: row.status,
    logical_id: row.logical_id,
    version: versionToken(row),
    event,
  };
}

function actionResult(row: ActionRow, event: CommandResult["event"]): CommandResult {
  return {
    id: row.id,
    object_type: "action",
    status: row.status,
    logical_id: row.logical_id,
    version: versionToken(row),
    event,
  };
}

// ===========================================================================
// Claim commands
// ===========================================================================

/** Create a candidate claim. Any authenticated writer may author candidates. */
export async function createClaim(ctx: CommandContext, body: Body): Promise<CommandResult> {
  requireRole(ctx.actor, ["author", "reviewer", "admin", "model"]);
  const links = evidenceLinks(body);
  const qualifiers = obj(body, "qualifiers");
  const logicalId = optStr(body, "logical_id");
  const validFrom = optStr(body, "valid_from");
  const validTo = optStr(body, "valid_to");

  return withTransaction(ctx.client, async (tx) => {
    const repos = createRepositories(tx as DbClient);
    const input: ClaimInput = {
      id: str(body, "id"),
      claim_type: str(body, "claim_type"),
      subject_ref: str(body, "subject_ref"),
      predicate: str(body, "predicate"),
      object_value: body.object ?? body.object_value ?? null,
      truth_value: truthValue(body),
      // Creation always yields a candidate; acceptance is a separate reviewed step.
      status: "candidate",
      recorded_at: str(body, "recorded_at"),
      origin: str(body, "origin"),
      created_by: ctx.actor.id,
      ...(logicalId !== undefined ? { logical_id: logicalId } : {}),
      ...(qualifiers !== undefined ? { qualifiers } : {}),
      ...(validFrom !== undefined ? { valid_from: validFrom } : {}),
      ...(validTo !== undefined ? { valid_to: validTo } : {}),
    };
    const row = await repos.claims.insert(input);
    for (const link of links) {
      await repos.claims.addEvidenceLink({ claim_id: row.id, ...link });
    }
    await appendAuditEvent(repos.audit, {
      actorId: ctx.actor.id,
      eventType: "claim.created",
      objectType: "claim",
      objectId: row.id,
      payload: { status: row.status, subject_ref: row.subject_ref, predicate: row.predicate },
    });
    return claimResult(row, "created");
  });
}

/** Submit a candidate claim for review. Records the submitter for SoD. */
export async function submitClaim(
  ctx: CommandContext,
  id: string,
  body: Body,
): Promise<CommandResult> {
  requireRole(ctx.actor, ["author", "reviewer", "admin"]);
  return withTransaction(ctx.client, async (tx) => {
    const repos = createRepositories(tx as DbClient);
    const row = await repos.claims.get(id);
    if (row === null) throw new NotFoundError(`claim ${id} not found`);
    assertExpectedVersion(row, optStr(body, "expected_version"));
    if (row.status !== "candidate") {
      throw new ConflictError("illegal_transition", `cannot submit a ${row.status} claim`, {
        status: row.status,
      });
    }
    await appendAuditEvent(repos.audit, {
      actorId: ctx.actor.id,
      eventType: "claim.submitted",
      objectType: "claim",
      objectId: id,
      payload: { status: row.status },
    });
    return claimResult(row, "submitted");
  });
}

/** Accept a candidate claim. Reviewer/admin only, never a self-approval. */
export async function acceptClaim(
  ctx: CommandContext,
  id: string,
  body: Body,
): Promise<CommandResult> {
  requireRole(ctx.actor, ["reviewer", "admin"]);
  return withTransaction(ctx.client, async (tx) => {
    const repos = createRepositories(tx as DbClient);
    const row = await repos.claims.get(id);
    if (row === null) throw new NotFoundError(`claim ${id} not found`);
    assertExpectedVersion(row, optStr(body, "expected_version"));
    if (row.status === "accepted") {
      throw new ConflictError("already_accepted", `claim ${id} is already accepted`);
    }
    if (row.status !== "candidate" && row.status !== "contested") {
      throw new ConflictError("illegal_transition", `cannot accept a ${row.status} claim`, {
        status: row.status,
      });
    }
    await assertNoSelfApproval(repos, "claim", id, ctx.actor);

    const accepted = await repos.claims.accept(id);
    // A durable accept review is what makes the claim score-eligible downstream.
    await repos.reviews.insert({
      id: `review:${id}:${accepted.status}:${ctx.actor.id}:${Date.now()}`,
      object_type: "claim",
      object_id: id,
      reviewer_id: ctx.actor.id,
      decision: "accept",
      rationale: optStr(body, "rationale") ?? "accepted via command API",
      created_at: new Date(),
    });
    await appendAuditEvent(repos.audit, {
      actorId: ctx.actor.id,
      eventType: "claim.accepted",
      objectType: "claim",
      objectId: id,
      payload: { from: row.status, to: accepted.status },
    });
    return claimResult(accepted, "accepted");
  });
}

/** Reject a candidate/contested claim. Reviewer/admin only. */
export async function rejectClaim(
  ctx: CommandContext,
  id: string,
  body: Body,
): Promise<CommandResult> {
  requireRole(ctx.actor, ["reviewer", "admin"]);
  return withTransaction(ctx.client, async (tx) => {
    const repos = createRepositories(tx as DbClient);
    const row = await repos.claims.get(id);
    if (row === null) throw new NotFoundError(`claim ${id} not found`);
    assertExpectedVersion(row, optStr(body, "expected_version"));
    if (row.status !== "candidate" && row.status !== "contested") {
      throw new ConflictError("illegal_transition", `cannot reject a ${row.status} claim`, {
        status: row.status,
      });
    }
    const rejected = await repos.claims.reject(id);
    await repos.reviews.insert({
      id: `review:${id}:rejected:${ctx.actor.id}:${Date.now()}`,
      object_type: "claim",
      object_id: id,
      reviewer_id: ctx.actor.id,
      decision: "reject",
      rationale: optStr(body, "rationale") ?? "rejected via command API",
      created_at: new Date(),
    });
    await appendAuditEvent(repos.audit, {
      actorId: ctx.actor.id,
      eventType: "claim.rejected",
      objectType: "claim",
      objectId: id,
      payload: { from: row.status, to: rejected.status },
    });
    return claimResult(rejected, "rejected");
  });
}

/** Contest a candidate claim (a dispute short of rejection). Reviewer/admin only. */
export async function contestClaim(
  ctx: CommandContext,
  id: string,
  body: Body,
): Promise<CommandResult> {
  requireRole(ctx.actor, ["reviewer", "admin"]);
  return withTransaction(ctx.client, async (tx) => {
    const repos = createRepositories(tx as DbClient);
    const row = await repos.claims.get(id);
    if (row === null) throw new NotFoundError(`claim ${id} not found`);
    assertExpectedVersion(row, optStr(body, "expected_version"));
    if (row.status !== "candidate") {
      throw new ConflictError("illegal_transition", `cannot contest a ${row.status} claim`, {
        status: row.status,
      });
    }
    const contested = await repos.claims.contest(id);
    await repos.reviews.insert({
      id: `review:${id}:contested:${ctx.actor.id}:${Date.now()}`,
      object_type: "claim",
      object_id: id,
      reviewer_id: ctx.actor.id,
      decision: "contest",
      rationale: optStr(body, "rationale") ?? "contested via command API",
      created_at: new Date(),
    });
    await appendAuditEvent(repos.audit, {
      actorId: ctx.actor.id,
      eventType: "claim.contested",
      objectType: "claim",
      objectId: id,
      payload: { from: row.status, to: contested.status },
    });
    return claimResult(contested, "contested");
  });
}

/**
 * Supersede a claim: close the prior (accepted) row and insert an accepted
 * replacement sharing its logical id. Reviewer/admin only. The supersession is
 * atomic in the repository; the audit event is appended immediately after.
 */
export async function supersedeClaim(
  ctx: CommandContext,
  id: string,
  body: Body,
): Promise<CommandResult> {
  requireRole(ctx.actor, ["reviewer", "admin"]);
  const repos = createRepositories(ctx.client);
  const current = await repos.claims.get(id);
  if (current === null) throw new NotFoundError(`claim ${id} not found`);
  assertExpectedVersion(current, optStr(body, "expected_version"));
  if (current.status !== "accepted") {
    throw new ConflictError("illegal_transition", `only accepted claims are superseded`, {
      status: current.status,
    });
  }
  if (current.system_to !== null) {
    throw new ConflictError("stale_version", `claim ${id} is not the current open version`);
  }

  const qualifiers = obj(body, "qualifiers");
  const validFrom = optStr(body, "valid_from");
  const validTo = optStr(body, "valid_to");
  const replacement: ClaimInput = {
    id: str(body, "replacement_id"),
    claim_type: optStr(body, "claim_type") ?? current.claim_type,
    subject_ref: optStr(body, "subject_ref") ?? current.subject_ref,
    predicate: optStr(body, "predicate") ?? current.predicate,
    object_value: body.object ?? body.object_value ?? current.object_value,
    truth_value: (optStr(body, "truth_value") as TruthValue | undefined) ?? current.truth_value,
    status: "accepted",
    recorded_at: optStr(body, "recorded_at") ?? new Date().toISOString(),
    origin: optStr(body, "origin") ?? current.origin,
    logical_id: current.logical_id,
    created_by: ctx.actor.id,
    ...(qualifiers !== undefined ? { qualifiers } : {}),
    ...(validFrom !== undefined ? { valid_from: validFrom } : {}),
    ...(validTo !== undefined ? { valid_to: validTo } : {}),
  };

  const { replacement: inserted } = await repos.claims.supersede(id, replacement);
  await appendAuditEvent(repos.audit, {
    actorId: ctx.actor.id,
    eventType: "claim.superseded",
    objectType: "claim",
    objectId: id,
    payload: { superseded_by: inserted.id, logical_id: inserted.logical_id },
  });
  return { ...claimResult(inserted, "superseded"), replacement_id: inserted.id };
}

// ===========================================================================
// Action commands
// ===========================================================================

/** Create a candidate action. Any authenticated writer may author candidates. */
export async function createAction(ctx: CommandContext, body: Body): Promise<CommandResult> {
  requireRole(ctx.actor, ["author", "reviewer", "admin", "model"]);
  const actors = strArray(body, "actors", 1);
  const structuredBody = obj(body, "structured_body");
  const logicalId = optStr(body, "logical_id");
  const instrumentType = optStr(body, "instrument_type");
  const durability = optStr(body, "durability");
  const announcementTime = optStr(body, "announcement_time");
  const validFrom = optStr(body, "valid_from");
  const validTo = optStr(body, "valid_to");
  const programFamilyId = optStr(body, "program_family_id");
  const underlyingInstrumentId = optStr(body, "underlying_instrument_id");
  const claimIds = body.claim_ids === undefined ? [] : strArray(body, "claim_ids", 0);

  return withTransaction(ctx.client, async (tx) => {
    const repos = createRepositories(tx as DbClient);
    const input: ActionInput = {
      id: str(body, "id"),
      label: str(body, "label"),
      jurisdiction: str(body, "jurisdiction"),
      kind: str(body, "kind"),
      implementation_stage: str(body, "implementation_stage"),
      beneficiary_targeting: str(body, "beneficiary_targeting"),
      attribution: str(body, "attribution"),
      status: "candidate",
      actors,
      ...(logicalId !== undefined ? { logical_id: logicalId } : {}),
      ...(instrumentType !== undefined ? { instrument_type: instrumentType } : {}),
      ...(durability !== undefined ? { durability } : {}),
      ...(announcementTime !== undefined ? { announcement_time: announcementTime } : {}),
      ...(validFrom !== undefined ? { valid_from: validFrom } : {}),
      ...(validTo !== undefined ? { valid_to: validTo } : {}),
      ...(programFamilyId !== undefined ? { program_family_id: programFamilyId } : {}),
      ...(underlyingInstrumentId !== undefined
        ? { underlying_instrument_id: underlyingInstrumentId }
        : {}),
      ...(structuredBody !== undefined ? { structured_body: structuredBody } : {}),
    };
    const row = await repos.actions.insert(input);
    for (const claimId of claimIds) {
      await repos.claims.linkToAction(row.id, claimId);
    }
    await appendAuditEvent(repos.audit, {
      actorId: ctx.actor.id,
      eventType: "action.created",
      objectType: "action",
      objectId: row.id,
      payload: { status: row.status, jurisdiction: row.jurisdiction, kind: row.kind },
    });
    return actionResult(row, "created");
  });
}

/** Submit a candidate action for review. Records the submitter for SoD. */
export async function submitAction(
  ctx: CommandContext,
  id: string,
  body: Body,
): Promise<CommandResult> {
  requireRole(ctx.actor, ["author", "reviewer", "admin"]);
  return withTransaction(ctx.client, async (tx) => {
    const repos = createRepositories(tx as DbClient);
    const row = await repos.actions.get(id);
    if (row === null) throw new NotFoundError(`action ${id} not found`);
    assertExpectedVersion(row, optStr(body, "expected_version"));
    if (row.status !== "candidate") {
      throw new ConflictError("illegal_transition", `cannot submit a ${row.status} action`, {
        status: row.status,
      });
    }
    await appendAuditEvent(repos.audit, {
      actorId: ctx.actor.id,
      eventType: "action.submitted",
      objectType: "action",
      objectId: id,
      payload: { status: row.status },
    });
    return actionResult(row, "submitted");
  });
}

/** Accept a candidate action. Reviewer/admin only, never a self-approval. */
export async function acceptAction(
  ctx: CommandContext,
  id: string,
  body: Body,
): Promise<CommandResult> {
  requireRole(ctx.actor, ["reviewer", "admin"]);
  return withTransaction(ctx.client, async (tx) => {
    const repos = createRepositories(tx as DbClient);
    const row = await repos.actions.get(id);
    if (row === null) throw new NotFoundError(`action ${id} not found`);
    assertExpectedVersion(row, optStr(body, "expected_version"));
    if (row.status === "accepted") {
      throw new ConflictError("already_accepted", `action ${id} is already accepted`);
    }
    if (row.status !== "candidate" && row.status !== "contested") {
      throw new ConflictError("illegal_transition", `cannot accept a ${row.status} action`, {
        status: row.status,
      });
    }
    await assertNoSelfApproval(repos, "action", id, ctx.actor);

    const accepted = await repos.actions.accept(id);
    await repos.reviews.insert({
      id: `review:${id}:accepted:${ctx.actor.id}:${Date.now()}`,
      object_type: "action",
      object_id: id,
      reviewer_id: ctx.actor.id,
      decision: "accept",
      rationale: optStr(body, "rationale") ?? "accepted via command API",
      created_at: new Date(),
    });
    await appendAuditEvent(repos.audit, {
      actorId: ctx.actor.id,
      eventType: "action.accepted",
      objectType: "action",
      objectId: id,
      payload: { from: row.status, to: accepted.status },
    });
    return actionResult(accepted, "accepted");
  });
}

/** Reject a candidate/contested action. Reviewer/admin only. */
export async function rejectAction(
  ctx: CommandContext,
  id: string,
  body: Body,
): Promise<CommandResult> {
  requireRole(ctx.actor, ["reviewer", "admin"]);
  return withTransaction(ctx.client, async (tx) => {
    const repos = createRepositories(tx as DbClient);
    const row = await repos.actions.get(id);
    if (row === null) throw new NotFoundError(`action ${id} not found`);
    assertExpectedVersion(row, optStr(body, "expected_version"));
    if (row.status !== "candidate" && row.status !== "contested") {
      throw new ConflictError("illegal_transition", `cannot reject a ${row.status} action`, {
        status: row.status,
      });
    }
    const rejected = await repos.actions.reject(id);
    await repos.reviews.insert({
      id: `review:${id}:rejected:${ctx.actor.id}:${Date.now()}`,
      object_type: "action",
      object_id: id,
      reviewer_id: ctx.actor.id,
      decision: "reject",
      rationale: optStr(body, "rationale") ?? "rejected via command API",
      created_at: new Date(),
    });
    await appendAuditEvent(repos.audit, {
      actorId: ctx.actor.id,
      eventType: "action.rejected",
      objectType: "action",
      objectId: id,
      payload: { from: row.status, to: rejected.status },
    });
    return actionResult(rejected, "rejected");
  });
}

/** Contest a candidate action. Reviewer/admin only. */
export async function contestAction(
  ctx: CommandContext,
  id: string,
  body: Body,
): Promise<CommandResult> {
  requireRole(ctx.actor, ["reviewer", "admin"]);
  return withTransaction(ctx.client, async (tx) => {
    const repos = createRepositories(tx as DbClient);
    const row = await repos.actions.get(id);
    if (row === null) throw new NotFoundError(`action ${id} not found`);
    assertExpectedVersion(row, optStr(body, "expected_version"));
    if (row.status !== "candidate") {
      throw new ConflictError("illegal_transition", `cannot contest a ${row.status} action`, {
        status: row.status,
      });
    }
    const contested = await repos.actions.contest(id);
    await repos.reviews.insert({
      id: `review:${id}:contested:${ctx.actor.id}:${Date.now()}`,
      object_type: "action",
      object_id: id,
      reviewer_id: ctx.actor.id,
      decision: "contest",
      rationale: optStr(body, "rationale") ?? "contested via command API",
      created_at: new Date(),
    });
    await appendAuditEvent(repos.audit, {
      actorId: ctx.actor.id,
      eventType: "action.contested",
      objectType: "action",
      objectId: id,
      payload: { from: row.status, to: contested.status },
    });
    return actionResult(contested, "contested");
  });
}

/** Supersede an accepted action with an accepted replacement. Reviewer/admin only. */
export async function supersedeAction(
  ctx: CommandContext,
  id: string,
  body: Body,
): Promise<CommandResult> {
  requireRole(ctx.actor, ["reviewer", "admin"]);
  const repos = createRepositories(ctx.client);
  const current = await repos.actions.get(id);
  if (current === null) throw new NotFoundError(`action ${id} not found`);
  assertExpectedVersion(current, optStr(body, "expected_version"));
  if (current.status !== "accepted") {
    throw new ConflictError("illegal_transition", `only accepted actions are superseded`, {
      status: current.status,
    });
  }
  if (current.system_to !== null) {
    throw new ConflictError("stale_version", `action ${id} is not the current open version`);
  }

  const actors =
    body.actors === undefined ? (current.actors as string[]) : strArray(body, "actors", 1);
  const structuredBody = obj(body, "structured_body");
  const replacement: ActionInput = {
    id: str(body, "replacement_id"),
    label: optStr(body, "label") ?? current.label,
    jurisdiction: optStr(body, "jurisdiction") ?? current.jurisdiction,
    kind: optStr(body, "kind") ?? current.kind,
    implementation_stage: optStr(body, "implementation_stage") ?? current.implementation_stage,
    beneficiary_targeting: optStr(body, "beneficiary_targeting") ?? current.beneficiary_targeting,
    attribution: optStr(body, "attribution") ?? current.attribution,
    status: "accepted",
    actors,
    logical_id: current.logical_id,
    ...(structuredBody !== undefined ? { structured_body: structuredBody } : {}),
  };

  const { replacement: inserted } = await repos.actions.supersede(id, replacement);
  await appendAuditEvent(repos.audit, {
    actorId: ctx.actor.id,
    eventType: "action.superseded",
    objectType: "action",
    objectId: id,
    payload: { superseded_by: inserted.id, logical_id: inserted.logical_id },
  });
  return { ...actionResult(inserted, "superseded"), replacement_id: inserted.id };
}
