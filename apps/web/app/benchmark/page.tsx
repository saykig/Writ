import type { Metadata } from "next";

import { benchmark, benchmarkLedger, evaluateMember, memberSnapshot } from "@/lib/toolchain";
import { rioCorpus } from "@/lib/rio-corpus";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { PageHeader } from "@/components/site/page-header";
import { Reveal } from "@/components/site/reveal";
import { TruthBadge } from "@/components/site/truth-badge";
import { NumberTicker } from "@/components/site/number-ticker";
import { BenchmarkExplorer } from "@/components/benchmark/benchmark-explorer";
import { RioCorpusPanel } from "@/components/benchmark/rio-corpus-panel";
import type { ActionView, MemberView, Score } from "@/components/benchmark/types";

export const metadata: Metadata = {
  title: "Benchmark · Writ",
  description:
    "Two datasets, kept methodologically distinct: the 2025 G7 AI-for-SMEs benchmark, where published scores are reproduced from frozen evidence, and the G20 2024 Rio compliance corpus, whose published scores are imported without any Writ scoring.",
};

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

/** A counted fact about the imported Rio corpus. Counts only; nothing derived. */
function RioFact({ value, label }: { value: number; label: string }) {
  return (
    <div className="border-t border-border pt-4">
      <p className="font-display text-[1.6rem] leading-none tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-2 text-[0.85rem] leading-snug text-muted-foreground">{label}</p>
    </div>
  );
}

/** A single quiet fact in the hero ledger line. */
function Fact({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <NumberTicker
        value={value}
        className="font-display text-[1.35rem] leading-none tabular-nums text-foreground"
      />
      <span className="text-ink-muted">{label}</span>
    </span>
  );
}

export default function BenchmarkPage() {
  const bench = benchmark();
  const ledger = benchmarkLedger();
  const summary = bench.summary;
  const rio = rioCorpus();

  const notesByMember = new Map(
    ledger.interpretation_sensitivity.map((entry) => [entry.member, entry.note]),
  );

  const members = bench.cells
    .map((cell) => buildMember(cell, notesByMember.get(cell.member) ?? cell.note))
    .filter((m): m is MemberView => m !== null);

  return (
    <main className="flex-1">
      <PageHeader
        eyebrow="2025 G7 AI-for-SMEs benchmark · G20 Rio 2024 corpus"
        title="See Writ used for policy compliance"
        description="Two datasets, kept methodologically distinct. The 2025 G7 demonstration reproduces a published compliance assessment, applying a real methodology to reviewed evidence to produce an inspectable result. The G20 Rio 2024 corpus is the opposite direction: published compliance reports imported into normalized records, with no Writ scoring at all."
        actions={
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[0.95rem]">
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
        }
      />

      {/* ── Datasets ─────────────────────────────────────────────────────── */}
      <nav
        aria-label="Datasets on this page"
        className="border-b border-border bg-card/25"
      >
        <div className="mx-auto flex max-w-[72rem] flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:gap-6 sm:px-8">
          <p className="label-mono shrink-0">Datasets</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="#g7-2025" className="text-foreground underline-offset-4 hover:underline">
              G7 2025 · AI-for-SMEs
              <span className="ml-2 text-muted-foreground">reproduced by Writ</span>
            </a>
            <a href="#g20-rio-2024" className="text-foreground underline-offset-4 hover:underline">
              G20 Rio 2024 · compliance
              <span className="ml-2 text-muted-foreground">imported, as published</span>
            </a>
          </div>
        </div>
      </nav>

      {/* ── The matrix ───────────────────────────────────────────────────── */}
      <section id="g7-2025" className="mx-auto max-w-[72rem] scroll-mt-20 px-5 py-20 sm:px-8 lg:py-24">
        <Reveal className="max-w-[52ch]">
          <SectionLabel>G7 2025 · the matrix</SectionLabel>
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

      {/* ── G20 Rio 2024: an imported corpus, not a Writ evaluation ──────── */}
      <section
        id="g20-rio-2024"
        className="border-t border-border bg-card/25 scroll-mt-20"
      >
        <div className="mx-auto max-w-[72rem] px-5 py-20 sm:px-8 lg:py-24">
          <Reveal className="max-w-[62ch]">
            <SectionLabel>G20 Rio 2024 · imported compliance corpus</SectionLabel>
            <SectionHeading className="mt-4">
              A published record, normalized and kept as published.
            </SectionHeading>
            <Prose className="mt-5">
              This is a different kind of dataset from the G7 benchmark above. Nothing here is a Writ
              evaluation. The Rio adapter reads the {rio.labelAuthority}&rsquo;s interim and final
              compliance reports and imports their published scores into normalized records, keeping
              the exact commitment text, the assessment window, and the source document for each
              one. Writ performs no compliance scoring on this corpus and makes no claim to reproduce
              it.
            </Prose>
          </Reveal>

          <Reveal className="mt-10 grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-4" delay={60}>
            <RioFact
              value={rio.counts.selectedCommitments}
              label="commitments selected for monitoring"
            />
            <RioFact value={rio.counts.memberAssessments} label="member assessments imported" />
            <RioFact value={rio.counts.reviewItems} label="review-queue items, all pending" />
            <RioFact value={rio.counts.members} label="members assessed per report" />
          </Reveal>

          <Reveal className="mt-10" delay={100}>
            <RioCorpusPanel
              reports={rio.reports}
              commitments={rio.commitments}
              members={rio.members}
            />
          </Reveal>

          {/* The inventory gap, stated plainly rather than filled in. */}
          <Reveal className="mt-10 grid gap-6 lg:grid-cols-2" delay={140}>
            <div className="rounded-xl border border-border bg-background/40 p-6">
              <p className="label-mono">Reconciliation · {rio.reconciliation.validation_status}</p>
              <p className="mt-4 text-[0.92rem] leading-7 text-muted-foreground">
                The G20 made{" "}
                <strong className="font-semibold text-foreground tabular-nums">
                  {rio.counts.expectedInventory}
                </strong>{" "}
                commitments at the Rio summit. The compliance reports enumerate only the{" "}
                <strong className="font-semibold text-foreground tabular-nums">
                  {rio.counts.extractedInventory}
                </strong>{" "}
                selected for monitoring, so that is all this corpus contains. The remaining
                commitments are absent rather than reconstructed, and the reconciliation manifest
                stays <span className="font-mono text-[0.8rem]">incomplete</span> until the
                inventory source is ingested.
              </p>
              <ul className="mt-4 flex flex-col gap-1.5">
                {rio.reconciliation.reconciliation_warnings.map((warning) => (
                  <li key={warning} className="font-mono text-[0.72rem] text-ink-faint">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-background/40 p-6">
              <p className="label-mono">Review queue · {rio.counts.reviewItems} pending</p>
              <p className="mt-4 text-[0.92rem] leading-7 text-muted-foreground">
                Anything the source left ambiguous became a review item instead of a value. None has
                been resolved automatically.
              </p>
              <dl className="mt-4 divide-y divide-border border-y border-border text-sm">
                {rio.reviewCountsByType.map((entry) => (
                  <div key={entry.issueType} className="flex justify-between gap-5 py-2.5">
                    <dt className="font-mono text-[0.76rem] text-muted-foreground">
                      {entry.issueType}
                    </dt>
                    <dd className="tabular-nums">{entry.count}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>

          <Reveal className="mt-8" delay={180}>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.72rem] text-ink-faint">
              <span>{rio.summitId}</span>
              <span aria-hidden>·</span>
              <span>{rio.parserVersion}</span>
              <span aria-hidden>·</span>
              <span>retrieved {rio.retrievalDate}</span>
              <span aria-hidden>·</span>
              <span>
                expert-assigned historical scores, not transferable to new commitments
              </span>
            </p>
          </Reveal>
        </div>
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
