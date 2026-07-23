import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { benchmark, benchmarkLedger, evaluateMember, memberSnapshot } from "@/lib/toolchain";
import { Button } from "@/components/ui/button";
import { HashPill } from "@/components/site/hash-pill";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { Stat } from "@/components/site/stat";
import { TruthBadge } from "@/components/site/truth-badge";
import { BenchmarkExplorer } from "@/components/benchmark/benchmark-explorer";
import type { ActionView, MemberView, Score } from "@/components/benchmark/types";

export const metadata: Metadata = {
  title: "Benchmark — Covenant",
  description:
    "The 2025 G7 AI-for-SMEs benchmark: all eight members' published scores reproduced from one frozen, reviewed evidence snapshot, with the two interpretation-sensitive cells named.",
};

const reveal =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-700";

const MEMBER_LABELS: Record<string, string> = {
  canada: "Canada",
  france: "France",
  germany: "Germany",
  italy: "Italy",
  japan: "Japan",
  united_kingdom: "United Kingdom",
  united_states: "United States",
  european_union: "European Union",
};

const SENSITIVE_DIMENSION = "interpretation:general-ai-measure";
const CLASSIFICATION_PREDICATE = "rubric_classification";

/**
 * Build the client view model for one member from its frozen snapshot and the
 * two evaluation receipts (published + generous). Everything here is the real
 * toolchain; the client only renders what this returns.
 */
function buildMember(
  cell: ReturnType<typeof benchmark>["cells"][number],
  note: string,
): MemberView | null {
  const snapshot = memberSnapshot(cell.member);
  if (!snapshot) return null;

  const published = evaluateMember(cell.member, "published");
  const generous = evaluateMember(cell.member, "generous");
  const qualifying = published?.qualifying_action_ids ?? [];

  const actionById = new Map(snapshot.actions.map((a) => [a.id, a]));
  const passageById = new Map(snapshot.passages.map((p) => [p.id, p]));

  const actions: ActionView[] = [];
  let strongCount = 0;
  let weakCount = 0;
  let sensitiveCount = 0;

  for (const actionId of qualifying) {
    const action = actionById.get(actionId);
    if (!action) continue;
    const claim = snapshot.claims.find(
      (c) => c.subject_ref === actionId && c.predicate === CLASSIFICATION_PREDICATE,
    );
    if (!claim) continue;

    const passageId = claim.evidence_links?.[0]?.passage_id;
    const passage = passageId ? passageById.get(passageId) : undefined;
    const review = snapshot.reviews.find((r) => r.object_id === claim.id);
    const sensitive = (action.dimensions ?? []).includes(SENSITIVE_DIMENSION);
    const classification = String(claim.object);

    if (classification === "strong") strongCount += 1;
    else if (classification === "weak") weakCount += 1;
    if (sensitive) sensitiveCount += 1;

    actions.push({
      id: action.id,
      label: action.label,
      jurisdiction: action.jurisdiction ?? "—",
      kind: action.instrument_type ?? action.kind ?? "—",
      implementationStage: action.implementation_stage ?? "—",
      attribution: action.attribution ?? "—",
      targeting: action.beneficiary_targeting ?? "—",
      classification,
      sensitive,
      claim: {
        id: claim.id,
        predicate: claim.predicate,
        object: classification,
        truthValue: claim.truth_value,
        status: claim.status,
      },
      passage: {
        page: passage?.page_number ?? null,
        quote: passage?.quote ?? "",
        anchorHash: passage?.anchor_hash ?? "",
      },
      review: {
        reviewerId: review?.reviewer_id ?? "—",
        decision: review?.decision ?? "accept",
        rationale: review?.rationale ?? "",
      },
    });
  }

  // Order: the reading-sensitive actions first (the seam), then strong, then weak.
  const rank = (a: ActionView) => (a.sensitive ? 0 : a.classification === "strong" ? 1 : 2);
  actions.sort((a, b) => rank(a) - rank(b));

  return {
    id: cell.member,
    label: MEMBER_LABELS[cell.member] ?? cell.member,
    published: cell.published as Score,
    computed: cell.computed as Score,
    generous: cell.generous as Score,
    match: cell.match,
    flips: cell.flips,
    sensitive: cell.sensitive,
    strongCount,
    weakCount,
    sensitiveCount,
    generousStrongCount: strongCount + sensitiveCount,
    qualifyingCount: actions.length,
    note,
    cellNote: cell.note,
    snapshot: {
      id: snapshot.snapshot.id,
      frozenAt: snapshot.snapshot.frozen_at,
      cutoff: snapshot.snapshot.cutoff,
      contentHash: snapshot.snapshot.content_hash,
    },
    publishedHash: published?.canonical_hash ?? "",
    generousHash: generous?.canonical_hash ?? "",
    publishedRule: published?.matched_rule_id ?? "—",
    generousRule: generous?.matched_rule_id ?? "—",
    resultStatus: published?.result_status ?? "—",
    actions,
  };
}

export default function BenchmarkPage() {
  const bench = benchmark();
  const ledger = benchmarkLedger();
  const summary = bench.summary;

  const notesByMember = new Map(
    ledger.interpretation_sensitivity.map((entry) => [entry.member, entry.note]),
  );

  const members = bench.cells
    .map((cell) => buildMember(cell, notesByMember.get(cell.member) ?? cell.note))
    .filter((m): m is MemberView => m !== null);

  const sensitive = members.filter((m) => m.sensitive);
  const sensitiveNames = sensitive.map((m) => m.label);

  return (
    <main className="flex-1">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 right-[-12%] h-[30rem] w-[30rem] rounded-full opacity-[0.06] blur-3xl"
          style={{ background: "radial-gradient(circle, var(--gold) 0%, transparent 70%)" }}
        />
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6 lg:py-24">
          <SectionLabel seam className={reveal}>
            2025 G7 AI-for-SMEs · discrepancy ledger
          </SectionLabel>

          <h1
            className={`mt-6 max-w-4xl font-serif text-[2.5rem] leading-[1.04] tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] ${reveal}`}
            style={{ animationDelay: "80ms" }}
          >
            All eight members, reproduced from one frozen snapshot.
          </h1>

          <div className={`mt-7 ${reveal}`} style={{ animationDelay: "160ms" }}>
            <Prose>
              Every 2025 published AI-for-SMEs score was recomputed by the deterministic evaluator
              over reviewed, page-anchored evidence under a single interpretation profile. All eight
              computed scores equal the published record. Two of them —{" "}
              <strong>{sensitiveNames.join(" and ")}</strong> — hold that{" "}
              <TruthBadge value="0" className="mx-0.5 align-middle" /> only under a strict reading
              of the rubric; read general, non-SME AI legislation as strong and both flip to{" "}
              <TruthBadge value="+1" className="mx-0.5 align-middle" />. Where a score turns on a
              reading rather than a fact, the ledger marks it in gold.
            </Prose>
          </div>
        </div>
      </section>

      {/* ── Figures band ─────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-[76rem] grid-cols-2 gap-x-6 gap-y-10 px-5 py-14 sm:px-6 lg:grid-cols-4">
          <Stat
            value={summary.cells}
            label="Cells reproduced"
            sub="All eight G7 members, recomputed from frozen evidence."
          />
          <Stat
            value={summary.matches}
            label="Match published"
            sub="Every computed score equals the 2025 published score."
          />
          <Stat
            tone="gold"
            value={summary.interpretation_sensitive_cells}
            label="Interpretation-sensitive"
            sub={`${sensitiveNames.join(" and ")} hold a published 0 only under a strict reading.`}
          />
          <Stat
            value={
              <span className="font-mono text-2xl tracking-tight sm:text-3xl">AI_SME_ADOPTION</span>
            }
            label="Commitment"
            sub={
              <span className="font-mono text-[0.72rem] leading-snug text-ink-faint">
                {bench.methodologyVersionId}
              </span>
            }
          />
        </div>
      </section>

      {/* ── The matrix ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
        <div className="max-w-2xl">
          <SectionLabel seam>The matrix</SectionLabel>
          <SectionHeading className="mt-4">
            One row per member. Click any row to open its evidence.
          </SectionHeading>
          <Prose className="mt-4">
            Published is the 2025 score of record. Computed is what the evaluator returns from the
            frozen snapshot. Generous re-runs the same evaluation with general AI measures read as
            strong. The strong-action count is what the score rule reads: five or more strong
            actions is <TruthBadge value="+1" className="mx-0.5 align-middle" />, one to four is{" "}
            <TruthBadge value="0" className="mx-0.5 align-middle" />.
          </Prose>
        </div>

        <div className="mt-9">
          <BenchmarkExplorer members={members} />
        </div>
      </section>

      {/* ── The seam ─────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="flex flex-col">
              <SectionLabel seam>The two seams</SectionLabel>
              <SectionHeading className="mt-4">A match can still turn on a reading.</SectionHeading>
              <Prose className="mt-4">
                Six members carry a score that no interpretation moves. The other two agree with the
                published record only because one governed decision — how to classify general,
                non-SME AI legislation — was resolved as weak. That decision is a judgment, not a
                fact of the record, and the ledger keeps it in the open rather than folding it into
                the number.
              </Prose>
            </div>

            <ul className="flex flex-col gap-px overflow-hidden rounded-[4px] border border-border">
              {sensitive.map((m) => (
                <li key={m.id} className="bg-gold-wash p-5 [border-left:2px_solid_var(--gold)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-serif text-xl tracking-tight">{m.label}</h3>
                    <span className="inline-flex items-center gap-1.5 font-mono text-[0.78rem] tabular-nums text-gold">
                      <TruthBadge value={m.published} />
                      <ArrowRight className="size-3.5" aria-hidden />
                      <TruthBadge value={m.generous} />
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{m.note}</p>
                  <p className="mt-3 font-mono text-[0.72rem] tabular-nums text-ink-faint">
                    {m.strongCount} strong under <span className="text-ink-soft">published</span>
                    <span className="text-gold"> → </span>
                    {m.generousStrongCount} strong under{" "}
                    <span className="text-ink-soft">generous</span> · {m.sensitiveCount} general AI{" "}
                    {m.sensitiveCount === 1 ? "measure" : "measures"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Closing: the ledger is the product ───────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>The real product</SectionLabel>
            <SectionHeading className="mt-4">The ledger, not the leaderboard.</SectionHeading>
            <Prose className="mt-4">
              A table of eight matching scores is the easy part. What Covenant ships is the record
              beneath it: for every cell, the actions that qualified, the passage each
              classification rests on, the reviewer who accepted it, and the content hash that pins
              the whole snapshot. Where a score depends on judgment rather than public fact, the
              ledger says so by name — and hands you the two receipts so you can watch it move.
            </Prose>
          </div>

          <figure className="mt-9 max-w-3xl overflow-hidden rounded-[4px] border border-border bg-surface-2/30 [border-left:2px_solid_var(--gold)]">
            <figcaption className="flex items-center justify-between gap-4 border-b border-border/80 bg-gold-wash px-4 py-2">
              <span className="label-mono">Discrepancy ledger · generated note</span>
              <span className="font-mono text-[0.7rem] text-ink-faint">
                {ledger.benchmark_reference}
              </span>
            </figcaption>
            <blockquote className="px-4 py-4 font-serif text-[1.02rem] leading-relaxed text-foreground/90 [text-wrap:pretty]">
              {ledger.generated_note}
            </blockquote>
            <div className="flex flex-wrap items-center gap-3 border-t border-border/80 px-4 py-3">
              <span className="label-mono">Methodology</span>
              <span className="font-mono text-[0.72rem] text-ink-soft">
                {ledger.methodology_version_id}
              </span>
              {members[0]?.snapshot.contentHash ? (
                <HashPill hash={members[0].snapshot.contentHash} label="snapshot" chars={10} />
              ) : null}
            </div>
          </figure>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button
              size="lg"
              nativeButton={false}
              render={
                <Link href={"/playground" as Route}>
                  Open the playground
                  <ArrowRight />
                </Link>
              }
            />
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={
                <Link href={"/governance" as Route}>
                  How evidence is governed
                  <ArrowUpRight />
                </Link>
              }
            />
          </div>
        </div>
      </section>
    </main>
  );
}
