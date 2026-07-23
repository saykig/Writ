import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GitBranch, KeyRound, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CodeArtifact } from "@/components/site/code-artifact";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { Stat } from "@/components/site/stat";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Governance — Covenant",
  description:
    "The governed evidence ledger: a normative methodology, a reviewed evidence snapshot, and a deterministic receipt — separated by role, versioned by content hash, and append-only by construction.",
};

const reveal =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-700";

// ── The three governed layers (00_EXECUTIVE_BRIEF.md §1) ─────────────────────
const LAYERS = [
  {
    n: "01",
    name: "Normative methodology",
    body: "What was promised, by whom, under which definitions, during what window, and under which scoring rule. A compiled, versioned bundle — not prose.",
  },
  {
    n: "02",
    name: "Reviewed evidence",
    body: "What public actions occurred, which sources support them, how they were attributed, and what reviewers accepted or disputed. A candidate becomes a fact only through review.",
  },
  {
    n: "03",
    name: "Deterministic receipt",
    body: "The mechanical derivation from accepted evidence and a versioned interpretation profile to a score — or an unresolved result. A report is a view over these layers, never their source.",
  },
];

// ── Roles + separation of duties (apps/api/src/http/auth.ts, commands/evidence.ts) ──
type Cell = "yes" | "no" | "only";
interface RoleRow {
  readonly role: string;
  readonly gloss: string;
  readonly create: Cell;
  readonly submit: Cell;
  readonly decide: Cell;
  readonly freeze: Cell;
}
const ROLES: readonly RoleRow[] = [
  {
    role: "model",
    gloss: "Proposes candidates only",
    create: "only",
    submit: "no",
    decide: "no",
    freeze: "no",
  },
  {
    role: "author",
    gloss: "Authors and submits evidence",
    create: "yes",
    submit: "yes",
    decide: "no",
    freeze: "no",
  },
  {
    role: "reviewer",
    gloss: "Decides on submitted evidence",
    create: "yes",
    submit: "yes",
    decide: "yes",
    freeze: "no",
  },
  {
    role: "admin",
    gloss: "Decides and freezes snapshots",
    create: "yes",
    submit: "yes",
    decide: "yes",
    freeze: "yes",
  },
];
const ROLE_COLS: readonly { key: keyof RoleRow; label: string }[] = [
  { key: "create", label: "Create candidate" },
  { key: "submit", label: "Submit" },
  { key: "decide", label: "Accept / reject" },
  { key: "freeze", label: "Freeze" },
];

function CellMark({ value }: { value: Cell }) {
  if (value === "no") return <span className="text-ink-faint">—</span>;
  if (value === "only")
    return <span className="font-mono text-[0.72rem] text-gold">candidate</span>;
  return <span className="text-true">✓</span>;
}

// ── The command endpoints, verbatim from apps/api/src/http/app.ts ENDPOINTS ──
interface Endpoint {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly purpose: string;
  readonly roles: string;
}
const ENDPOINTS: readonly Endpoint[] = [
  { method: "GET", path: "/health", purpose: "Liveness probe.", roles: "public" },
  { method: "POST", path: "/v1/claims", purpose: "Mint a candidate claim.", roles: "any writer" },
  {
    method: "POST",
    path: "/v1/claims/:id/submit",
    purpose: "Submit a candidate for review.",
    roles: "author +",
  },
  {
    method: "POST",
    path: "/v1/claims/:id/accept",
    purpose: "Accept a candidate (separation of duties enforced).",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/claims/:id/reject",
    purpose: "Reject a candidate or contested claim.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/claims/:id/contest",
    purpose: "Mark a claim disputed, short of rejection.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/claims/:id/supersede",
    purpose: "Replace an accepted claim with a new accepted row.",
    roles: "reviewer +",
  },
  { method: "POST", path: "/v1/actions", purpose: "Mint a candidate action.", roles: "any writer" },
  {
    method: "POST",
    path: "/v1/actions/:id/submit",
    purpose: "Submit a candidate action for review.",
    roles: "author +",
  },
  {
    method: "POST",
    path: "/v1/actions/:id/accept",
    purpose: "Accept a candidate action.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/actions/:id/reject",
    purpose: "Reject a candidate or contested action.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/actions/:id/contest",
    purpose: "Mark an action disputed.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/actions/:id/supersede",
    purpose: "Replace an accepted action with a new accepted row.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/snapshots/freeze",
    purpose: "Freeze the score-eligible evidence into an immutable snapshot.",
    roles: "admin",
  },
  {
    method: "GET",
    path: "/v1/snapshots/:id/export",
    purpose: "Re-materialize a snapshot and verify its content hash.",
    roles: "authenticated",
  },
];

// ── The submit → accept → freeze → export walkthrough ────────────────────────
interface Step {
  readonly n: string;
  readonly title: string;
  readonly actor: string;
  readonly body: string;
  readonly filename: string;
  readonly label: string;
  readonly code: string;
  readonly seam: number[];
  readonly response: string;
}
const STEPS: readonly Step[] = [
  {
    n: "01",
    title: "Create the candidate",
    actor: "author or model",
    body: "Any authenticated writer mints a candidate action. Creation only ever yields a candidate — never an accepted record. The Idempotency-Key makes a retried request replay the stored response instead of minting a duplicate.",
    filename: "01-create.http",
    label: "POST · candidate action",
    code: `POST /v1/actions HTTP/1.1
Authorization: Bearer author-token
Idempotency-Key: 5b1e-create-action-ca-compute-fund
Content-Type: application/json

{
  "id": "action-ca-compute-fund",
  "label": "AI Compute Access Fund for SMEs",
  "jurisdiction": "canada",
  "kind": "funding_program",
  "implementation_stage": "funded",
  "beneficiary_targeting": "sme_direct",
  "attribution": "national",
  "actors": ["canada"],
  "claim_ids": ["claim-ca-compute-fund-targets-smes"]
}`,
    seam: [3],
    response: `201 Created
{ "id": "action-ca-compute-fund", "status": "candidate",
  "event": "created", "version": "sha256:9f2c…" }`,
  },
  {
    n: "02",
    title: "Submit for review",
    actor: "author",
    body: "The author submits the candidate. The submitter is recorded on the append-only audit trail; that record is what separation of duties later reads. An optional expected_version guards against a concurrent edit.",
    filename: "02-submit.http",
    label: "POST · submit for review",
    code: `POST /v1/actions/action-ca-compute-fund/submit HTTP/1.1
Authorization: Bearer author-token
Idempotency-Key: 5b1e-submit-action-ca-compute-fund
Content-Type: application/json

{ "expected_version": "sha256:9f2c…" }`,
    seam: [6],
    response: `200 OK
{ "status": "candidate", "event": "submitted",
  "version": "sha256:9f2c…" }`,
  },
  {
    n: "03",
    title: "Accept — by a different actor",
    actor: "reviewer",
    body: "A reviewer accepts. The command reconstructs the author/submitter set from the audit trail and refuses a self-approval: the actor who authored or submitted may not review it. Acceptance writes a durable review and is what makes the record score-eligible.",
    filename: "03-accept.http",
    label: "POST · accept (SoD)",
    code: `POST /v1/actions/action-ca-compute-fund/accept HTTP/1.1
Authorization: Bearer reviewer-token
Idempotency-Key: 5b1e-accept-action-ca-compute-fund
Content-Type: application/json

{
  "expected_version": "sha256:9f2c…",
  "rationale": "Program record and SME targeting confirmed against source."
}`,
    seam: [2],
    response: `200 OK
{ "status": "accepted", "event": "accepted",
  "version": "sha256:41ab…" }

403 self_approval  ·  if the same actor authored or submitted it`,
  },
  {
    n: "04",
    title: "Freeze the snapshot",
    actor: "admin",
    body: "An admin freezes. The service selects every accepted, reviewed record recorded on or before the cutoff, assembles an immutable evidence document, content-addresses it, and records the frozen membership. Re-freezing the same instant yields the same hash.",
    filename: "04-freeze.http",
    label: "POST · freeze snapshot",
    code: `POST /v1/snapshots/freeze HTTP/1.1
Authorization: Bearer admin-token
Idempotency-Key: 5b1e-freeze-ai-sme-2025-10-31
Content-Type: application/json

{
  "id": "snapshot-canada-ai-sme-2025-10-31",
  "cutoff": "2025-10-31T23:59:59Z",
  "description": "AI-for-SMEs · Canada · Q3 review round"
}`,
    seam: [9],
    response: `201 Created
{ "id": "snapshot-canada-ai-sme-2025-10-31",
  "content_hash": "sha256:1c4e…", "cutoff": "2025-10-31T23:59:59Z",
  "claim_count": 12, "action_count": 7 }`,
  },
  {
    n: "05",
    title: "Export and verify",
    actor: "any authenticated actor",
    body: "Export re-materializes the frozen membership, recomputes the content hash, and refuses to return the document if it no longer matches the frozen hash. The exported shape is exactly what the evaluator consumes — evidence added afterward is invisible to a snapshot already frozen.",
    filename: "05-export.http",
    label: "GET · export + integrity check",
    code: `GET /v1/snapshots/snapshot-canada-ai-sme-2025-10-31/export HTTP/1.1
Authorization: Bearer reviewer-token`,
    seam: [],
    response: `200 OK   ·   schema-valid evidence document
{ "schema_version": "1.0.0",
  "snapshot": { "content_hash": "sha256:1c4e…", … },
  "claims": [ … ], "actions": [ … ], "reviews": [ … ] }

409 snapshot_integrity  ·  if the recomputed hash ≠ the frozen hash`,
  },
];

const GUARANTEES = [
  {
    icon: KeyRound,
    title: "Optimistic concurrency",
    body: "Every object carries a version token — the hash of its id, status, and system-time bounds. A write that presents a stale expected_version is rejected with 409 version_conflict; re-read and retry.",
  },
  {
    icon: GitBranch,
    title: "Idempotency keys",
    body: "A repeated Idempotency-Key, scoped per actor, replays the stored response verbatim without re-running the command. A retried create never mints a duplicate candidate.",
  },
  {
    icon: ShieldCheck,
    title: "Append-only audit chain",
    body: "Every transition emits one immutable event, each hashed together with the prior event's hash. Two otherwise identical events get distinct hashes; any gap or reordering is detectable.",
  },
  {
    icon: Lock,
    title: "Immutable by construction",
    body: "Accepted records are superseded, never edited in place. Frozen snapshots, published receipts, and release manifests are immutable — corrections create new versions, and prior audit history is never rewritten.",
  },
];

export default function GovernancePage() {
  return (
    <main className="flex-1">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-6 sm:py-24">
          <SectionLabel seam className={reveal}>
            Governance
          </SectionLabel>
          <SectionHeading as="h1" className={cn("mt-5 text-4xl sm:text-5xl", reveal)}>
            The governed evidence ledger.
          </SectionHeading>
          <Prose className={cn("mt-6", reveal)}>
            A score is only as trustworthy as the evidence beneath it. Covenant separates the path
            from an international commitment to a compliance judgment into three governed layers,
            and gives each a role boundary, a content hash, and an append-only history. A model may
            propose; only a reviewer accepts; only an admin freezes. Nothing is edited in place.
          </Prose>
          <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            <Stat value="15" label="Command endpoints" sub="Every mutation is a typed command." />
            <Stat value="4" label="Authorization roles" sub="model · author · reviewer · admin." />
            <Stat
              tone="gold"
              value="0"
              label="In-place edits"
              sub="Records are superseded, never overwritten."
            />
            <Stat
              value="1:1"
              label="Event per transition"
              sub="Hash-chained, append-only, tamper-evident."
            />
          </div>
        </div>
      </section>

      {/* ── Three governed layers ─────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>Three governed layers</SectionLabel>
            <SectionHeading className="mt-4">
              Interpretation, evidence, and derivation — kept apart on purpose.
            </SectionHeading>
            <Prose className="mt-4">
              The methodology does not pretend political interpretation is mechanical, and it does
              not hide analyst judgment inside prose or a model prompt. Each layer is governed
              separately, so a disagreement can be located precisely.
            </Prose>
          </div>
          <ol className="mt-12 grid grid-cols-1 gap-px overflow-hidden border-t border-border md:grid-cols-3">
            {LAYERS.map((layer) => (
              <li
                key={layer.n}
                className="relative flex flex-col gap-3 bg-background/40 pt-6 md:px-6 md:pt-8"
              >
                <span aria-hidden className="absolute top-0 left-0 h-px w-10 bg-gold md:left-6" />
                <span className="font-mono text-sm text-gold tabular-nums">{layer.n}</span>
                <h3 className="font-serif text-xl tracking-tight">{layer.name}</h3>
                <p className="max-w-sm text-sm leading-relaxed text-ink-soft">{layer.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Roles + separation of duties ──────────────────────────────────── */}
      <section className="border-b border-border bg-surface/40">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>Roles &amp; separation of duties</SectionLabel>
            <SectionHeading className="mt-4">
              Authority is scoped to the token, and never trusts the request body.
            </SectionHeading>
            <Prose className="mt-4">
              A bearer token resolves to an actor and its roles. What an actor may do is decided by
              role; whether it may decide a <em>particular</em> object is decided by separation of
              duties — the author or submitter of evidence may not review it.
            </Prose>
          </div>

          <div className="mt-10 overflow-x-auto rounded-[4px] border border-border ring-1 ring-foreground/[0.03]">
            <table className="w-full min-w-[42rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-left">
                  <th className="label-mono px-4 py-2.5 font-normal">Role</th>
                  {ROLE_COLS.map((col) => (
                    <th key={col.key} className="label-mono px-4 py-2.5 text-center font-normal">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLES.map((row) => (
                  <tr key={row.role} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-mono text-[0.82rem] text-foreground">{row.role}</div>
                      <div className="text-xs text-ink-faint">{row.gloss}</div>
                    </td>
                    {ROLE_COLS.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-center tabular-nums">
                        <CellMark value={row[col.key] as Cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 max-w-3xl border-l-2 border-gold bg-gold-wash px-4 py-3">
            <p className="label-mono mb-1">The invariant</p>
            <p className="text-sm leading-relaxed text-ink-soft">
              Whoever accepts an object must not be one of the actors who authored or submitted it.
              The set is reconstructed from the immutable audit trail, so it holds for both claims
              and actions without a dedicated column. A model actor can create candidates and
              nothing else — it never accepts evidence, resolves a dispute, waives a diagnostic, or
              publishes a score.
            </p>
          </div>
        </div>
      </section>

      {/* ── Guarantees ────────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>What holds under concurrency and retries</SectionLabel>
            <SectionHeading className="mt-4">
              Four guarantees, enforced in the write path.
            </SectionHeading>
          </div>
          <div className="mt-10 grid grid-cols-1 border-t border-l border-border sm:grid-cols-2">
            {GUARANTEES.map((g) => {
              const Icon = g.icon;
              return (
                <div
                  key={g.title}
                  className="flex flex-col gap-3 border-r border-b border-border p-6"
                >
                  <span className="flex size-8 items-center justify-center rounded-[3px] border border-border text-ink-soft">
                    <Icon className="size-4" />
                  </span>
                  <h3 className="font-serif text-lg leading-snug tracking-tight">{g.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{g.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Endpoint table ────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-surface/40">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>The command API</SectionLabel>
            <SectionHeading className="mt-4">
              Fifteen endpoints. Every mutation is a command.
            </SectionHeading>
            <Prose className="mt-4">
              These are not CRUD routes. Each mutating request authenticates the bearer token,
              enforces idempotency, runs role and separation-of-duties checks, applies the state
              transition, and emits exactly one audit event. A typed failure maps to a stable code;
              nothing else leaks a 500.
            </Prose>
          </div>

          <div className="mt-10 overflow-x-auto rounded-[4px] border border-border ring-1 ring-foreground/[0.03]">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-left">
                  <th className="label-mono px-4 py-2.5 font-normal">Method</th>
                  <th className="label-mono px-4 py-2.5 font-normal">Path</th>
                  <th className="label-mono px-4 py-2.5 font-normal">Command</th>
                  <th className="label-mono px-4 py-2.5 font-normal">Roles</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <tr
                    key={`${e.method} ${e.path}`}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "font-mono text-[0.72rem]",
                          e.method === "GET" ? "text-indigo" : "text-gold",
                        )}
                      >
                        {e.method}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[0.78rem] whitespace-nowrap text-foreground">
                      {e.path}
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{e.purpose}</td>
                    <td className="px-4 py-2.5 font-mono text-[0.72rem] whitespace-nowrap text-ink-faint">
                      {e.roles}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-prose text-xs leading-relaxed text-ink-faint">
            Every mutating command accepts an <span className="font-mono">Idempotency-Key</span>{" "}
            header and an optional <span className="font-mono">expected_version</span> guard.{" "}
            <span className="font-mono">any writer</span> is model, author, reviewer, or admin;{" "}
            <span className="font-mono">+</span> means that role and every role above it.
          </p>
        </div>
      </section>

      {/* ── Walkthrough ───────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>A full round: submit → accept → freeze → export</SectionLabel>
            <SectionHeading className="mt-4">
              One candidate, from proposal to a verifiable snapshot.
            </SectionHeading>
          </div>

          <div className="mt-6 max-w-3xl border-l-2 border-indigo/60 bg-indigo/5 px-4 py-3">
            <p className="text-sm leading-relaxed text-ink-soft">
              The live command API runs on PostgreSQL. The requests below are the exact, documented
              contract — headers, bodies, and typed responses — not a live call from this page.
              Every field maps to the write model in{" "}
              <span className="font-mono text-[0.82rem]">apps/api/src/http</span>.
            </p>
          </div>

          <ol className="mt-12 flex flex-col gap-12">
            {STEPS.map((step) => (
              <li key={step.n} className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10">
                <div className="flex flex-col gap-3">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm text-gold tabular-nums">{step.n}</span>
                    <span className="label-mono">{step.actor}</span>
                  </div>
                  <h3 className="font-serif text-xl tracking-tight">{step.title}</h3>
                  <p className="max-w-sm text-sm leading-relaxed text-ink-soft">{step.body}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <CodeArtifact
                    label={step.label}
                    filename={step.filename}
                    code={step.code}
                    seam={step.seam}
                    showLineNumbers={false}
                  />
                  <CodeArtifact
                    label="Response"
                    code={step.response}
                    showLineNumbers={false}
                    className="bg-surface/60"
                  />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto flex max-w-[76rem] flex-col items-start gap-6 px-5 py-20 sm:px-6">
          <SectionLabel seam>See it resolve</SectionLabel>
          <SectionHeading className="max-w-2xl text-3xl sm:text-4xl">
            A frozen snapshot is what a receipt stands on.
          </SectionHeading>
          <Prose>
            Evidence governance is one half of reproducibility; the deterministic evaluator is the
            other. Follow a score from a frozen snapshot to a receipt you can recompute.
          </Prose>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              nativeButton={false}
              render={
                <Link href="/how-it-works">
                  How it works
                  <ArrowRight />
                </Link>
              }
            />
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link href="/conformance">See the conformance suite</Link>}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
