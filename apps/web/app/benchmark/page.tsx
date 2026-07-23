import type { Metadata } from "next";

import { benchmark, benchmarkLedger, evaluateMember, memberSnapshot } from "@/lib/toolchain";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { Reveal } from "@/components/site/reveal";
import { TruthBadge } from "@/components/site/truth-badge";
import { BenchmarkExplorer } from "@/components/benchmark/benchmark-explorer";
import type { ActionView, MemberView, Score } from "@/components/benchmark/types";

export const metadata: Metadata = {
  title: "Benchmark · Covenant",
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

/** A single quiet fact in the hero ledger line. */
function Fact({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-display text-[1.35rem] leading-none tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-ink-muted">{label}</span>
    </span>
  );
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

  // "the United States" / "the United Kingdom" / "the European Union" read naturally in prose.
  const withArticle = (label: string) =>
    /^(United|European)/.test(label) ? `the ${label}` : label;
  const sensitiveNames = members.filter((m) => m.sensitive).map((m) => withArticle(m.label));

  return (
    <main className="flex-1">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[72rem] px-5 pt-20 pb-16 sm:px-8 lg:pt-28 lg:pb-20">
          <SectionLabel className={reveal}>2025 G7 AI-for-SMEs · discrepancy ledger</SectionLabel>

          <h1
            className={`mt-6 max-w-[20ch] font-display text-[length:var(--t-hero)] leading-[1.05] tracking-[-0.01em] text-balance ${reveal}`}
            style={{ animationDelay: "80ms" }}
          >
            All eight members, reproduced from one frozen snapshot.
          </h1>

          <div className={`mt-7 ${reveal}`} style={{ animationDelay: "160ms" }}>
            <Prose>
              Every 2025 published AI-for-SMEs score was recomputed by the deterministic evaluator
              over reviewed, page-anchored evidence under a single interpretation profile, and all
              eight computed scores equal the published record. Two of them,{" "}
              {sensitiveNames.join(" and ")}, hold a published{" "}
              <TruthBadge value="0" className="mx-0.5 align-middle" /> only under a strict reading
              of the rubric. Read general, non-SME AI legislation as strong and both flip to{" "}
              <TruthBadge value="+1" className="mx-0.5 align-middle" />. Where a score turns on a
              reading rather than a fact, the matrix marks it in gold.
            </Prose>
          </div>

          <div
            className={`mt-9 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-rule pt-6 text-[0.95rem] ${reveal}`}
            style={{ animationDelay: "240ms" }}
          >
            <Fact value={summary.cells} label="reproduced" />
            <span aria-hidden className="text-ink-faint">
              ·
            </span>
            <Fact value={summary.matches} label="match published" />
            <span aria-hidden className="text-ink-faint">
              ·
            </span>
            <Fact value={summary.interpretation_sensitive_cells} label="interpretation-sensitive" />
          </div>
        </div>
      </section>

      {/* ── The matrix ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[72rem] px-5 py-20 sm:px-8 lg:py-24">
        <Reveal className="max-w-[52ch]">
          <SectionLabel>The matrix</SectionLabel>
          <SectionHeading className="mt-4">
            Eight rows, one snapshot each. Open a row for its evidence.
          </SectionHeading>
          <Prose className="mt-5">
            Published is the 2025 score of record. Computed is what the evaluator returns from the
            frozen, reviewed evidence. Generous re-runs the same evaluation with general, non-SME AI
            measures read as strong. Only Japan and the United States move: their published{" "}
            <TruthBadge value="0" className="mx-0.5 align-middle" /> rests on a strict reading, and
            both cross to <TruthBadge value="+1" className="mx-0.5 align-middle" /> once five
            actions read strong.
          </Prose>
        </Reveal>

        <Reveal className="mt-10" delay={80}>
          <BenchmarkExplorer members={members} />
        </Reveal>
      </section>

      {/* ── Closing: the generated note ──────────────────────────────────── */}
      <section className="border-t border-rule">
        <div className="mx-auto max-w-[72rem] px-5 py-20 sm:px-8">
          <Reveal className="max-w-[60ch]">
            <SectionLabel>Discrepancy ledger</SectionLabel>
            <p className="mt-5 font-display text-[length:var(--t-h3)] leading-[1.42] tracking-[-0.005em] text-ink-soft [text-wrap:pretty]">
              {ledger.generated_note}
            </p>
            <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.72rem] text-ink-faint">
              <span className="tabular-nums">{ledger.benchmark_reference}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{ledger.methodology_version_id}</span>
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
