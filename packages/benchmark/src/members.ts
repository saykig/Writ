// Compatibility projection for the historical G7 score-reproduction benchmark.
//
// Political actors, actions, and passages are authoritative in the independent
// G7 corpus. Strong/weak/counter assignments remain benchmark-local because
// they are interpretations made under one evaluator methodology.

import { readFileSync } from "node:fs";
import {
  G7_ACTIONS_PATH,
  G7_ACTORS_PATH,
  G7_JUDGMENTS_PATH,
  G7_SOURCE_MANIFEST_PATH,
  ASSIGNMENTS_PATH,
} from "./paths.js";

export type Classification = "strong" | "weak" | "counter";

export interface ActionSeed {
  readonly slug: string;
  readonly label: string;
  readonly date: string;
  readonly page: number;
  readonly footnote: number;
  readonly kind: string;
  readonly stage:
    | "proposed"
    | "announced"
    | "authorized"
    | "budgeted"
    | "funded"
    | "contracted"
    | "launched"
    | "operational"
    | "disbursing"
    | "evaluated"
    | "completed"
    | "suspended"
    | "repealed";
  readonly targeting:
    "explicit" | "materially_inclusive" | "indirect" | "general" | "absent" | "contested";
  readonly attribution:
    "unilateral" | "joint" | "collective" | "implementing_partner" | "external" | "disputed";
  readonly classification: Classification;
  readonly quote: string;
  readonly interpretation_sensitive?: boolean;
  readonly amount?: {
    readonly value: string;
    readonly currency: string;
    readonly bound: "exact" | "up_to" | "at_least" | "approximate";
  };
}

export interface MemberSeed {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly markerCoordinates: readonly [number, number];
  readonly markerAnchor: string;
  readonly published: "-1" | "0" | "+1";
  readonly analyst: string;
  readonly sectionPage: number;
  readonly actions: readonly ActionSeed[];
}

interface ActorRecord {
  readonly id: string;
  readonly name: string;
  readonly short_code: string;
  readonly marker_coordinates: [number, number];
  readonly marker_anchor: string;
  readonly analyst: string;
  readonly source_section_page: number;
}

interface ActionRecord {
  readonly id: string;
  readonly label: string;
  readonly actor_ids: readonly string[];
  readonly kind: string;
  readonly announcement_time: string;
  readonly implementation_stage: ActionSeed["stage"];
  readonly beneficiary_targeting: ActionSeed["targeting"];
  readonly attribution: ActionSeed["attribution"];
  readonly source_passage_ids: readonly string[];
  readonly source_anchor: { readonly page: number; readonly footnote: number };
  readonly amounts?: readonly [ActionSeed["amount"]];
}

interface AssignmentRecord {
  readonly id: string;
  readonly action_id: string;
  readonly assigned_value: Classification;
  readonly interpretation_sensitive: boolean;
}

interface JudgmentRecord {
  readonly subject_ref: string;
  readonly reported_value: MemberSeed["published"];
  readonly origin: "source_reported";
  readonly writ_derived: false;
}

interface PassageRecord {
  readonly id: string;
  readonly quote: string;
}

const loadJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

const actors = loadJson<ActorRecord[]>(G7_ACTORS_PATH);
const actions = loadJson<ActionRecord[]>(G7_ACTIONS_PATH);
const assignments = loadJson<AssignmentRecord[]>(ASSIGNMENTS_PATH);
const judgments = loadJson<JudgmentRecord[]>(G7_JUDGMENTS_PATH);
const passages = loadJson<{ passages: PassageRecord[] }>(G7_SOURCE_MANIFEST_PATH).passages;

const assignmentByAction = new Map(
  assignments.map((assignment) => [assignment.action_id, assignment]),
);
const judgmentByActor = new Map(judgments.map((judgment) => [judgment.subject_ref, judgment]));
const passageById = new Map(passages.map((passage) => [passage.id, passage]));

const actorMemberId = (actorId: string): string => actorId.replace(/^actor-/, "");
const actionSlug = (actionId: string, memberId: string): string =>
  actionId.replace(new RegExp(`^action-${memberId}-`), "");

export const MEMBERS: readonly MemberSeed[] = actors.map((actor) => {
  const memberId = actorMemberId(actor.id);
  const judgment = judgmentByActor.get(actor.id);
  if (judgment === undefined) {
    throw new Error(`G7 corpus has no published judgment for ${actor.id}`);
  }
  return {
    id: memberId,
    code: actor.short_code,
    name: actor.name,
    markerCoordinates: actor.marker_coordinates,
    markerAnchor: actor.marker_anchor,
    published: judgment.reported_value,
    analyst: actor.analyst,
    sectionPage: actor.source_section_page,
    actions: actions
      .filter((action) => action.actor_ids.includes(actor.id))
      .map((action) => {
        const assignment = assignmentByAction.get(action.id);
        const passageId = action.source_passage_ids[0];
        const passage = passageId === undefined ? undefined : passageById.get(passageId);
        if (assignment === undefined || passage === undefined) {
          throw new Error(`Incomplete G7 benchmark projection for ${action.id}`);
        }
        return {
          slug: actionSlug(action.id, memberId),
          label: action.label,
          date: action.announcement_time.slice(0, 10),
          page: action.source_anchor.page,
          footnote: action.source_anchor.footnote,
          kind: action.kind,
          stage: action.implementation_stage,
          targeting: action.beneficiary_targeting,
          attribution: action.attribution,
          classification: assignment.assigned_value,
          quote: passage.quote,
          ...(assignment.interpretation_sensitive ? { interpretation_sensitive: true } : {}),
          ...(action.amounts?.[0] ? { amount: action.amounts[0] } : {}),
        };
      }),
  };
});

if (MEMBERS.length !== 8 || MEMBERS.flatMap((member) => member.actions).length !== 87) {
  throw new Error("G7 corpus projection must contain 8 actors and exactly 87 actions");
}
