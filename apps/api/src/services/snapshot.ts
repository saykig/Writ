// DATA-003 — evidence snapshot freeze + export.
//
// Freezing selects the score-eligible evidence (accepted, recorded on-or-before
// the cutoff, reviewed) as of a system-time instant, assembles an immutable
// evidence document, content-addresses it with `@writ/provenance`, and
// records the frozen membership. Export re-materializes that document and
// validates it against `specs/evidence.schema.json` (via `@writ/domain`).
//
// The exported document's shape is EXACTLY what `evaluateCommitment` consumes:
// `{ schema_version, snapshot, document_versions, passages, claims, actions,
// reviews }`. Because export is scoped to the frozen document-version membership
// AND bounded by the snapshot's system-time (`system_from <= frozen_at`, reviews
// `created_at <= frozen_at`), evidence added afterward is invisible to a
// previously frozen snapshot — re-exporting yields a byte-identical document and
// the same content hash (invariant: accepted records are superseded, not edited;
// a frozen snapshot never changes).

import type { Evidence } from "@writ/domain";
import { assertValid } from "@writ/domain";
import { evidenceSnapshotHash } from "@writ/provenance";
import type { DbClient } from "../db/client.js";
import { createRepositories } from "../db/repositories/index.js";
import type { Queryable } from "../db/repositories/shared.js";
import type { Actor } from "../http/auth.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../http/errors.js";
import { hasAnyRole } from "../http/auth.js";
import { appendAuditEvent } from "../commands/audit.js";

/** Fields excluded from the snapshot content hash: the hash itself and the (non-semantic) freeze instant. */
const HASH_DROP_FIELDS = ["/snapshot/content_hash", "/snapshot/frozen_at"] as const;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

// --- Raw row shapes read by the builder (snake_case, straight from SQL) ------

interface VersionJoinRow {
  id: string;
  document_id: string;
  canonical_uri: string;
  media_type: string;
  retrieved_at: Date;
  issued_at: Date | null;
  sha256: string;
  storage_uri: string;
  warc_record_id: string | null;
  publisher: string | null;
}

interface PassageRow {
  id: string;
  document_version_id: string;
  anchor_type: string;
  page_number: number | null;
  quote: string;
  normalized_quote: string | null;
  anchor_hash: string;
  language: string | null;
}

interface ClaimRow {
  id: string;
  claim_type: string;
  subject_ref: string;
  predicate: string;
  object_value: unknown;
  qualifiers: Record<string, unknown>;
  truth_value: string;
  status: string;
  valid_from: Date | null;
  valid_to: Date | null;
  recorded_at: Date;
  origin: string;
  created_by: string | null;
  supersedes_claim_id: string | null;
}

interface ActionRow {
  id: string;
  label: string;
  actors: unknown;
  jurisdiction: string;
  kind: string;
  instrument_type: string | null;
  announcement_time: Date | null;
  valid_from: Date | null;
  valid_to: Date | null;
  implementation_stage: string;
  beneficiary_targeting: string;
  durability: string | null;
  attribution: string;
  program_family_id: string | null;
  underlying_instrument_id: string | null;
  structured_body: Record<string, unknown>;
  status: string;
}

interface ReviewRow {
  id: string;
  object_type: string;
  object_id: string;
  reviewer_id: string;
  decision: string;
  rationale: string;
  conflict_of_interest: string | null;
  supersedes_review_id: string | null;
  created_at: Date;
}

interface LinkRow {
  claim_id: string;
  passage_id: string;
  stance: string;
  support_type: string;
}

interface ActionClaimRow {
  action_id: string;
  claim_id: string;
}

const POSITIVE = new Set(["accept", "approve"]);
const NEGATIVE = new Set(["reject", "contest", "request_changes", "withdraw"]);

function reviewsSatisfied(reviews: readonly ReviewRow[]): boolean {
  let positive = false;
  let negative = false;
  for (const r of reviews) {
    if (POSITIVE.has(r.decision)) positive = true;
    if (NEGATIVE.has(r.decision)) negative = true;
  }
  return positive && !negative;
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket === undefined) map.set(k, [row]);
    else bucket.push(row);
  }
  return map;
}

export interface BuildParams {
  readonly snapshotId: string;
  readonly cutoff: Date;
  readonly frozenAt: Date;
  readonly versionIds: readonly string[];
  readonly description?: string | undefined;
}

export interface BuiltSnapshot {
  readonly evidence: Evidence;
  readonly contentHash: string;
}

/**
 * Deterministically materialize the evidence document for a frozen membership
 * set. Pure with respect to the ledger: given the same (versionIds, cutoff,
 * frozenAt) it always returns the same document, and (because accepted rows are
 * immutable and everything is time-bounded) the same content hash.
 */
export async function buildEvidenceSnapshot(
  client: Queryable,
  params: BuildParams,
): Promise<BuiltSnapshot> {
  const { cutoff, frozenAt, versionIds } = params;
  const cutoffIso = iso(cutoff);
  const frozenIso = iso(frozenAt);

  const documentVersions: Record<string, unknown>[] = [];
  const passages: Record<string, unknown>[] = [];
  const claimsOut: Record<string, unknown>[] = [];
  const actionsOut: Record<string, unknown>[] = [];
  const reviewsOut: Record<string, unknown>[] = [];

  if (versionIds.length > 0) {
    const versionRows = await client<VersionJoinRow[]>`
      SELECT dv.id, dv.document_id, d.canonical_uri, dv.media_type, dv.retrieved_at,
             dv.issued_at, dv.sha256, dv.storage_uri, dv.warc_record_id, d.publisher
      FROM document_versions dv
      JOIN documents d ON d.id = dv.document_id
      WHERE dv.id = ANY(${versionIds as string[]})
      ORDER BY dv.id`;
    for (const v of versionRows) {
      documentVersions.push({
        id: v.id,
        document_id: v.document_id,
        uri: v.canonical_uri,
        media_type: v.media_type,
        retrieved_at: iso(v.retrieved_at),
        sha256: v.sha256,
        storage_uri: v.storage_uri,
        ...(v.issued_at !== null ? { issued_at: iso(v.issued_at) } : {}),
        ...(v.warc_record_id !== null ? { warc_record_id: v.warc_record_id } : {}),
        ...(v.publisher !== null ? { publisher: v.publisher } : {}),
      });
    }

    const passageRows = await client<PassageRow[]>`
      SELECT id, document_version_id, anchor_type, page_number, quote,
             normalized_quote, anchor_hash, language
      FROM passages
      WHERE document_version_id = ANY(${versionIds as string[]})
      ORDER BY id`;
    for (const p of passageRows) {
      passages.push({
        id: p.id,
        document_version_id: p.document_version_id,
        anchor_type: p.anchor_type,
        quote: p.quote,
        anchor_hash: p.anchor_hash,
        ...(p.page_number !== null ? { page_number: p.page_number } : {}),
        ...(p.normalized_quote !== null ? { normalized_quote: p.normalized_quote } : {}),
        ...(p.language !== null ? { language: p.language } : {}),
      });
    }

    // Score-eligible claims: accepted, recorded on-or-before cutoff, present in
    // the ledger at freeze time, and anchored to a member document version.
    const candidateClaims = await client<ClaimRow[]>`
      SELECT DISTINCT c.id, c.claim_type, c.subject_ref, c.predicate, c.object_value,
             c.qualifiers, c.truth_value, c.status, c.valid_from, c.valid_to,
             c.recorded_at, c.origin, c.created_by, c.supersedes_claim_id
      FROM claims c
      JOIN claim_evidence_links cel ON cel.claim_id = c.id
      JOIN passages p ON p.id = cel.passage_id
      WHERE c.status = 'accepted'
        AND c.recorded_at <= ${cutoff}
        AND c.system_from <= ${frozenAt}
        AND p.document_version_id = ANY(${versionIds as string[]})
      ORDER BY c.id`;

    const candidateClaimIds = candidateClaims.map((c) => c.id);
    const claimReviews =
      candidateClaimIds.length === 0
        ? []
        : await client<ReviewRow[]>`
            SELECT id, object_type, object_id, reviewer_id, decision, rationale,
                   conflict_of_interest, supersedes_review_id, created_at
            FROM reviews
            WHERE object_type = 'claim'
              AND object_id = ANY(${candidateClaimIds})
              AND created_at <= ${frozenAt}
            ORDER BY id`;
    const claimReviewsById = groupBy(claimReviews, (r) => r.object_id);

    const keptClaims = candidateClaims.filter((c) =>
      reviewsSatisfied(claimReviewsById.get(c.id) ?? []),
    );
    const keptClaimIds = keptClaims.map((c) => c.id);
    const keptClaimIdSet = new Set(keptClaimIds);

    const linkRows =
      keptClaimIds.length === 0
        ? []
        : await client<LinkRow[]>`
            SELECT cel.claim_id, cel.passage_id, cel.stance, cel.support_type
            FROM claim_evidence_links cel
            JOIN passages p ON p.id = cel.passage_id
            WHERE cel.claim_id = ANY(${keptClaimIds})
              AND p.document_version_id = ANY(${versionIds as string[]})
            ORDER BY cel.claim_id, cel.passage_id, cel.stance`;
    const linksByClaim = groupBy(linkRows, (l) => l.claim_id);

    for (const c of keptClaims) {
      const links = (linksByClaim.get(c.id) ?? []).map((l) => ({
        passage_id: l.passage_id,
        stance: l.stance,
        support_type: l.support_type,
      }));
      const validTime: Record<string, unknown> = {
        ...(c.valid_from !== null ? { start: iso(c.valid_from) } : {}),
        ...(c.valid_to !== null ? { end: iso(c.valid_to) } : {}),
      };
      claimsOut.push({
        id: c.id,
        claim_type: c.claim_type,
        subject_ref: c.subject_ref,
        predicate: c.predicate,
        object: c.object_value ?? null,
        qualifiers: c.qualifiers ?? {},
        truth_value: c.truth_value,
        status: c.status,
        valid_time: validTime,
        recorded_at: iso(c.recorded_at),
        origin: c.origin,
        evidence_links: links,
        ...(c.created_by !== null ? { created_by: c.created_by } : {}),
        ...(c.supersedes_claim_id !== null ? { supersedes_claim_id: c.supersedes_claim_id } : {}),
      });
    }

    // Score-eligible actions: accepted, announced/valid on-or-before cutoff,
    // present at freeze time, and supported by at least one eligible claim.
    const candidateActions =
      keptClaimIds.length === 0
        ? []
        : await client<ActionRow[]>`
            SELECT DISTINCT a.id, a.label, a.actors, a.jurisdiction, a.kind,
                   a.instrument_type, a.announcement_time, a.valid_from, a.valid_to,
                   a.implementation_stage, a.beneficiary_targeting, a.durability,
                   a.attribution, a.program_family_id, a.underlying_instrument_id,
                   a.structured_body, a.status
            FROM actions a
            JOIN action_claims ac ON ac.action_id = a.id
            WHERE a.status = 'accepted'
              AND (a.announcement_time IS NULL OR a.announcement_time <= ${cutoff})
              AND a.system_from <= ${frozenAt}
              AND ac.claim_id = ANY(${keptClaimIds})
            ORDER BY a.id`;

    const keptActionIds = candidateActions.map((a) => a.id);
    const actionClaimRows =
      keptActionIds.length === 0
        ? []
        : await client<ActionClaimRow[]>`
            SELECT ac.action_id, ac.claim_id
            FROM action_claims ac
            WHERE ac.action_id = ANY(${keptActionIds})
              AND ac.claim_id = ANY(${keptClaimIds})
            ORDER BY ac.action_id, ac.claim_id`;
    const claimIdsByAction = groupBy(actionClaimRows, (r) => r.action_id);

    const STRUCTURED_KEYS = [
      "amounts",
      "relationships",
      "beneficiaries",
      "partner_classes",
      "dimensions",
    ] as const;

    for (const a of candidateActions) {
      const claimIds = (claimIdsByAction.get(a.id) ?? [])
        .map((r) => r.claim_id)
        .filter((id) => keptClaimIdSet.has(id));
      if (claimIds.length === 0) continue;
      const actors = Array.isArray(a.actors) ? (a.actors as string[]) : [];
      const validTime: Record<string, unknown> = {
        ...(a.valid_from !== null ? { start: iso(a.valid_from) } : {}),
        ...(a.valid_to !== null ? { end: iso(a.valid_to) } : {}),
      };
      const structured = a.structured_body ?? {};
      const structuredFields: Record<string, unknown> = {};
      for (const key of STRUCTURED_KEYS) {
        if (Object.prototype.hasOwnProperty.call(structured, key)) {
          structuredFields[key] = structured[key];
        }
      }
      actionsOut.push({
        id: a.id,
        label: a.label,
        actors,
        jurisdiction: a.jurisdiction,
        kind: a.kind,
        implementation_stage: a.implementation_stage,
        beneficiary_targeting: a.beneficiary_targeting,
        attribution: a.attribution,
        status: a.status,
        claim_ids: claimIds,
        ...(a.instrument_type !== null ? { instrument_type: a.instrument_type } : {}),
        ...(a.announcement_time !== null ? { announcement_time: iso(a.announcement_time) } : {}),
        ...(Object.keys(validTime).length > 0 ? { valid_time: validTime } : {}),
        ...(a.durability !== null ? { durability: a.durability } : {}),
        ...(a.program_family_id !== null ? { program_family_id: a.program_family_id } : {}),
        ...(a.underlying_instrument_id !== null
          ? { underlying_instrument_id: a.underlying_instrument_id }
          : {}),
        ...structuredFields,
      });
    }

    // Reviews for the retained objects (bounded by freeze time), so the
    // evaluator recomputes the same eligibility from the snapshot alone.
    const objectIds = [...keptClaimIds, ...keptActionIds];
    const retainedReviews =
      objectIds.length === 0
        ? []
        : await client<ReviewRow[]>`
            SELECT id, object_type, object_id, reviewer_id, decision, rationale,
                   conflict_of_interest, supersedes_review_id, created_at
            FROM reviews
            WHERE ((object_type = 'claim' AND object_id = ANY(${keptClaimIds.length ? keptClaimIds : [""]}))
                OR (object_type = 'action' AND object_id = ANY(${keptActionIds.length ? keptActionIds : [""]})))
              AND created_at <= ${frozenAt}
            ORDER BY id`;
    for (const r of retainedReviews) {
      reviewsOut.push({
        id: r.id,
        object_type: r.object_type,
        object_id: r.object_id,
        reviewer_id: r.reviewer_id,
        decision: r.decision,
        rationale: r.rationale,
        created_at: iso(r.created_at),
        ...(r.conflict_of_interest !== null
          ? { conflict_of_interest: r.conflict_of_interest }
          : {}),
        ...(r.supersedes_review_id !== null
          ? { supersedes_review_id: r.supersedes_review_id }
          : {}),
      });
    }
  }

  const snapshotMeta: Record<string, unknown> = {
    id: params.snapshotId,
    frozen_at: frozenIso,
    cutoff: cutoffIso,
    content_hash: "sha256:" + "0".repeat(64), // placeholder; replaced below
    ...(params.description !== undefined ? { description: params.description } : {}),
  };

  const evidence = {
    schema_version: "1.0.0",
    snapshot: snapshotMeta,
    document_versions: documentVersions,
    passages,
    claims: claimsOut,
    actions: actionsOut,
    reviews: reviewsOut,
  };

  const contentHash = evidenceSnapshotHash(evidence, { dropFields: [...HASH_DROP_FIELDS] });
  snapshotMeta.content_hash = contentHash;

  return { evidence: evidence as unknown as Evidence, contentHash };
}

// --- Default membership -----------------------------------------------------

/** All document versions backing an eligible accepted claim as of the cutoff/freeze instant. */
async function defaultMembership(
  client: Queryable,
  cutoff: Date,
  frozenAt: Date,
): Promise<string[]> {
  const rows = await client<{ document_version_id: string }[]>`
    SELECT DISTINCT p.document_version_id
    FROM claims c
    JOIN claim_evidence_links cel ON cel.claim_id = c.id
    JOIN passages p ON p.id = cel.passage_id
    WHERE c.status = 'accepted'
      AND c.recorded_at <= ${cutoff}
      AND c.system_from <= ${frozenAt}
    ORDER BY p.document_version_id`;
  return rows.map((r) => r.document_version_id);
}

// --- Public service surface --------------------------------------------------

export interface FreezeInput {
  readonly id?: string;
  readonly cutoff: string;
  readonly description?: string;
  readonly document_version_ids?: readonly string[];
}

export interface FreezeSummary {
  readonly id: string;
  readonly content_hash: string;
  readonly frozen_at: string;
  readonly cutoff: string;
  readonly document_version_ids: readonly string[];
  readonly claim_count: number;
  readonly action_count: number;
}

/**
 * Freeze a snapshot: select membership, build + hash the immutable document,
 * persist the snapshot and its membership, and emit an audit event. Admin-only.
 */
export async function freezeSnapshot(
  client: DbClient,
  actor: Actor,
  input: FreezeInput,
): Promise<FreezeSummary> {
  if (!hasAnyRole(actor, "admin")) {
    throw new ForbiddenError("forbidden_role", "role admin required to freeze a snapshot", {
      actor_roles: actor.roles,
    });
  }
  if (typeof input.cutoff !== "string" || input.cutoff.trim() === "") {
    throw new ValidationError('field "cutoff" (ISO-8601) is required');
  }
  const cutoff = new Date(input.cutoff);
  if (Number.isNaN(cutoff.getTime())) {
    throw new ValidationError('field "cutoff" must be a valid ISO-8601 instant');
  }
  const frozenAt = new Date();
  const snapshotId = input.id ?? `snapshot-${frozenAt.toISOString()}-${cutoff.getTime()}`;

  const repos = createRepositories(client);
  const versionIds =
    input.document_version_ids !== undefined
      ? [...input.document_version_ids]
      : await defaultMembership(client, cutoff, frozenAt);

  const built = await buildEvidenceSnapshot(client, {
    snapshotId,
    cutoff,
    frozenAt,
    versionIds,
    ...(input.description !== undefined ? { description: input.description } : {}),
  });

  await repos.snapshots.freeze({
    id: snapshotId,
    frozen_at: frozenAt,
    cutoff,
    content_hash: built.contentHash,
    created_by: actor.id,
    document_version_ids: versionIds,
    ...(input.description !== undefined ? { description: input.description } : {}),
  });

  await appendAuditEvent(repos.audit, {
    actorId: actor.id,
    eventType: "snapshot.frozen",
    objectType: "evidence_snapshot",
    objectId: snapshotId,
    payload: {
      content_hash: built.contentHash,
      cutoff: cutoff.toISOString(),
      document_version_ids: versionIds,
    },
  });

  return {
    id: snapshotId,
    content_hash: built.contentHash,
    frozen_at: frozenAt.toISOString(),
    cutoff: cutoff.toISOString(),
    document_version_ids: versionIds,
    claim_count: built.evidence.claims.length,
    action_count: built.evidence.actions.length,
  };
}

/**
 * Export a frozen snapshot as a schema-valid evidence document. Re-materializes
 * the frozen membership, verifies the recomputed content hash equals the stored
 * one (proof of immutability), and validates against `evidence.schema.json`.
 */
export async function exportSnapshot(client: DbClient, snapshotId: string): Promise<Evidence> {
  const repos = createRepositories(client);
  const snapshot = await repos.snapshots.get(snapshotId);
  if (snapshot === null) {
    throw new NotFoundError(`evidence snapshot ${snapshotId} not found`);
  }
  const versionIds = await repos.snapshots.listMembers(snapshotId);

  const built = await buildEvidenceSnapshot(client, {
    snapshotId,
    cutoff: snapshot.cutoff,
    frozenAt: snapshot.frozen_at,
    versionIds,
    ...(snapshot.description !== null ? { description: snapshot.description } : {}),
  });

  if (built.contentHash !== snapshot.content_hash) {
    throw new ConflictError(
      "snapshot_integrity",
      "recomputed snapshot content hash does not match the frozen hash",
      { expected: snapshot.content_hash, actual: built.contentHash },
    );
  }
  // Pin the exported hash to the stored (frozen) one and validate the document.
  const evidence = built.evidence as unknown as { snapshot: { content_hash: string } };
  evidence.snapshot.content_hash = snapshot.content_hash;

  assertValid("evidence", built.evidence);
  return built.evidence;
}
