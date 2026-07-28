import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CodeArtifact } from "@/components/site/code-artifact";
import { HashPill } from "@/components/site/hash-pill";
import { PageHeader } from "@/components/site/page-header";
import { Pipeline } from "@/components/site/pipeline";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { TruthBadge, type TruthBadgeValue } from "@/components/site/truth-badge";
import { ArchitectureDiagram } from "@/components/how-it-works/architecture-diagram";
import { EssayIndex, type EssaySection } from "@/components/how-it-works/essay-index";
import { Faq } from "@/components/how-it-works/faq";
import { loadCoverage } from "@/lib/conformance";
import { rioCorpus } from "@/lib/rio-corpus";
import {
  analyze,
  benchmark,
  compile,
  evaluateMember,
  exampleSource,
  memberSnapshot,
  verify,
} from "@/lib/toolchain";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "How it works · Writ",
  description:
    "How Writ turns a written policy methodology into a typed program, checks it before any evidence, runs it against a frozen reviewed record, and returns a result anyone can recompute.",
};

const SECTIONS: readonly EssaySection[] = [
  { id: "pipeline", title: "The pipeline" },
  { id: "truth", title: "Four-valued truth" },
  { id: "language", title: "The language" },
  { id: "evidence", title: "Governed evidence" },
  { id: "corpora", title: "Imported corpora" },
  { id: "reproducible", title: "Reproducibility" },
  { id: "faq", title: "Questions" },
];

const ORDER: readonly TruthBadgeValue[] = ["true", "false", "unknown", "contested"];

const TRUTH_VALUES: readonly { value: TruthBadgeValue; pair: string; gloss: string }[] = [
  { value: "true", pair: "(1, 0)", gloss: "Support for truth, none for falsity." },
  { value: "false", pair: "(0, 1)", gloss: "Support for falsity, none for truth." },
  { value: "unknown", pair: "(0, 0)", gloss: "No support either way." },
  { value: "contested", pair: "(1, 1)", gloss: "Accepted evidence conflicts." },
];

/** Conjunction, row-major in ORDER. Disjunction is its dual; negation swaps the pair. */
const AND_TABLE: readonly (readonly TruthBadgeValue[])[] = [
  ["true", "false", "unknown", "contested"],
  ["false", "false", "false", "false"],
  ["unknown", "false", "unknown", "false"],
  ["contested", "false", "false", "contested"],
];

function Section({
  id,
  label,
  heading,
  children,
  first = false,
}: {
  id: string;
  label: string;
  heading: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24",
        first ? "" : "mt-20 border-t border-border pt-16 sm:mt-24 sm:pt-20",
      )}
    >
      <SectionLabel>{label}</SectionLabel>
      <SectionHeading className="mt-3 max-w-[26ch]">{heading}</SectionHeading>
      {children}
    </section>
  );
}

/** Native progressive disclosure for the detail most readers will skip. */
function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="tool group mt-8 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <span
          aria-hidden
          className="text-muted-foreground/70 transition-transform duration-200 group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-border px-4 py-5">{children}</div>
    </details>
  );
}

/** A row of counted facts. Every number on this page is computed, not written. */
function Facts({ items }: { items: { label: string; value: string | number; mono?: boolean }[] }) {
  return (
    <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="label">{item.label}</dt>
          <dd
            className={cn(
              "mt-1.5 text-[1.05rem] font-medium break-words",
              item.mono ? "font-mono text-[0.85rem]" : "tabular-nums",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function HowItWorksPage() {
  // Everything below is compiled, evaluated, and counted on this request.
  const literalSource = exampleSource("literal") ?? "";
  const ir = compile(literalSource).ir;
  const commitment = ir?.commitments[0];
  const literalFindings = analyze(literalSource).findings;
  const resolvedFindings = analyze(exampleSource("resolved") ?? "").findings;

  let sampleHash: string | undefined;
  let verified = false;
  try {
    const receipt = evaluateMember("japan", "published");
    sampleHash = receipt?.canonical_hash;
    if (receipt) verified = verify(receipt).valid;
  } catch {
    sampleHash = undefined;
  }

  const snapshot = memberSnapshot("japan");
  const reviewedClaims = snapshot?.claims.filter((c) => c.status === "accepted").length ?? 0;
  const bench = benchmark();
  const rio = rioCorpus();
  const { areas, totalCases, totalFiles } = loadCoverage();
  const maxCases = Math.max(...areas.map((area) => area.cases));

  return (
    <main className="flex-1">
      <PageHeader
        eyebrow="How it works"
        title="From methodology to reproducible assessment."
        description="A policy methodology becomes a typed program. Writ checks it before any evidence, runs it against a frozen reviewed record, and returns a result anyone can recompute."
      />

      <article className="mx-auto w-[min(100%-2.5rem,72rem)] pt-14 pb-24 sm:pt-20">
        <div className="grid grid-cols-1 gap-y-4 min-[900px]:grid-cols-[220px_minmax(0,1fr)] min-[900px]:gap-x-16">
          <EssayIndex
            sections={SECTIONS}
            note="The pipeline, its logic, its language, the evidence beneath it, and what makes a result reproducible."
            updated="July 2026"
          />

          <div className="min-w-0">
            {/* 1 · Pipeline */}
            <Section
              first
              id="pipeline"
              label="The pipeline"
              heading="Source, to canonical IR, to evaluator, to receipt."
            >
              <Prose className="mt-5">
                Four stages, each producing a real artifact rather than a status. The rubric is read
                as a program, checked before any evidence is involved, scored against a frozen
                record, and returned with a proof of how it was reached.
              </Prose>

              <div className="mt-8">
                <Pipeline />
              </div>

              <Disclosure summary="The full architecture, package by package">
                <ArchitectureDiagram />
              </Disclosure>
            </Section>

            {/* 2 · Truth */}
            <Section
              id="truth"
              label="Four-valued truth"
              heading="Two values cannot tell no from we do not know."
            >
              <Prose className="mt-5">
                A missing fact and a disproved one are different findings, and collapsing them is
                how a gap in the record turns into a failing score. Writ keeps four values, each a
                pair recording support for truth and support for falsity.
              </Prose>

              <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TRUTH_VALUES.map((item) => (
                  <div key={item.value} className="tool flex items-start gap-3 p-4">
                    <TruthBadge value={item.value} />
                    <div className="min-w-0">
                      <dt className="font-mono text-[0.78rem] text-muted-foreground">
                        {item.pair}
                      </dt>
                      <dd className="mt-1 text-[0.86rem] leading-6 text-muted-foreground">
                        {item.gloss}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>

              <figure className="mt-8">
                <figcaption className="label">Conjunction</figcaption>
                <div className="tool mt-3 overflow-x-auto">
                  <table className="w-full min-w-[30rem] border-collapse text-[0.8rem]">
                    <caption className="sr-only">
                      Conjunction of two four-valued truth values.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="p-3 text-left">
                          <span className="label">and</span>
                        </th>
                        {ORDER.map((value) => (
                          <th key={value} scope="col" className="p-3 text-left font-normal">
                            <TruthBadge value={value} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {AND_TABLE.map((row, rowIndex) => (
                        <tr key={ORDER[rowIndex]} className="border-t border-border">
                          <th scope="row" className="p-3 text-left font-normal">
                            <TruthBadge value={ORDER[rowIndex]} />
                          </th>
                          {row.map((cell, cellIndex) => (
                            <td key={`${ORDER[rowIndex]}-${ORDER[cellIndex]}`} className="p-3">
                              <TruthBadge value={cell} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[0.82rem] leading-6 text-muted-foreground">
                  <span className="font-medium text-foreground">unknown and false is false</span>,
                  because one disproved conjunct settles it. But{" "}
                  <span className="font-medium text-foreground">unknown and true is unknown</span> —
                  the result stays open rather than guessing.
                </p>
              </figure>
            </Section>

            {/* 3 · Language */}
            <Section id="language" label="The language" heading="A rubric, written as a program.">
              <Prose className="mt-5">
                The 2025 G7 AI-for-SMEs rubric, in Writ. Scoring bands, the evidence they draw on,
                and how actions are counted are all declared, so the analyzer can read the rubric as
                a program and find its defects before any evidence is gathered.
              </Prose>

              <div className="mt-8">
                <CodeArtifact
                  code={literalSource}
                  label="Methodology"
                  filename="2025-ai-sme-literal.writ"
                />
              </div>

              {commitment ? (
                <Facts
                  items={[
                    { label: "Package", value: ir?.package.name ?? "—", mono: true },
                    { label: "Variables", value: commitment.variables.length },
                    { label: "Parameters", value: commitment.parameters.length },
                    { label: "Score rules", value: commitment.score_program.rules.length },
                  ]}
                />
              ) : null}

              <h3 className="mt-10 text-[length:var(--t-h3)] leading-snug font-semibold">
                What the analyzer finds, before any evidence
              </h3>
              <p className="mt-3 max-w-[64ch] text-[0.9rem] leading-7 text-muted-foreground">
                The literal reading of the published rubric does not cover its own input space. Each
                finding carries the exact case that breaks it.
              </p>

              <ul className="mt-6 space-y-2">
                {literalFindings.map((finding, index) => (
                  <li key={`${finding.code}-${index}`} className="tool p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertTriangle aria-hidden className="size-3.5 shrink-0 text-false" />
                      <span className="font-mono text-[0.78rem] font-medium">{finding.code}</span>
                      <Badge variant="outline" className="text-[0.68rem]">
                        {finding.severity}
                      </Badge>
                    </div>
                    <p className="mt-2 text-[0.86rem] leading-6 text-muted-foreground">
                      {finding.message}
                    </p>
                  </li>
                ))}
              </ul>

              <p className="mt-5 flex flex-wrap items-center gap-2 text-[0.88rem] text-muted-foreground">
                <Check aria-hidden className="size-4 text-true" />
                The resolved reading of the same rubric analyzes clean:{" "}
                <span className="font-medium text-foreground">
                  {resolvedFindings.length} findings
                </span>
                . The ambiguity was in the prose, not the evidence.
              </p>

              <div className="mt-8">
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link href="/playground">
                      Open it in the Writ Lab
                      <ArrowRight />
                    </Link>
                  }
                />
              </div>
            </Section>

            {/* 4 · Governed evidence */}
            <Section
              id="evidence"
              label="Governed evidence"
              heading="A score is only as trustworthy as the record beneath it."
            >
              <Prose className="mt-5">
                Evidence is not a bag of links. Each passage is anchored in a document version, each
                claim points at the passage supporting it, and each claim and action carries a
                review decision by a named reviewer. A model may propose; it never accepts.
              </Prose>

              {snapshot ? (
                <>
                  <Facts
                    items={[
                      { label: "Anchored passages", value: snapshot.passages.length },
                      { label: "Claims", value: snapshot.claims.length },
                      { label: "Actions", value: snapshot.actions.length },
                      { label: "Review decisions", value: snapshot.reviews.length },
                    ]}
                  />
                  <p className="mt-5 max-w-[64ch] text-[0.88rem] leading-7 text-muted-foreground">
                    That is one member of the 2025 G7 snapshot — {reviewedClaims} of{" "}
                    {snapshot.claims.length} claims accepted, with {snapshot.reviews.length}{" "}
                    recorded decisions across the claims and the actions they support. Nothing
                    enters a score without one.
                  </p>
                </>
              ) : null}

              <Disclosure summary="Why a snapshot is frozen">
                <p className="max-w-[64ch] text-[0.88rem] leading-7 text-muted-foreground">
                  A published score names the exact evidence snapshot it was computed against, by
                  hash. Later evidence does not silently change an old result: it produces a new
                  snapshot, and a new score, leaving the original reproducible. Accepted records are
                  superseded, never edited in place.
                </p>
              </Disclosure>
            </Section>

            {/* 5 · Imported corpora */}
            <Section
              id="corpora"
              label="Imported corpora"
              heading="Reading someone else's compliance record, without rescoring it."
            >
              <Prose className="mt-5">
                Writ also carries corpora it did not score. Published results are imported verbatim
                with their provenance, and Writ computes nothing over them. Two are checked in.
              </Prose>

              <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="tool p-5">
                  <h3 className="text-[0.95rem] font-semibold">2025 G7 AI-for-SMEs</h3>
                  <p className="mt-2 text-[0.86rem] leading-6 text-muted-foreground">
                    Writ recomputes every published cell from the frozen evidence and compares. A
                    mismatch would become a discrepancy record, not a hidden exception.
                  </p>
                  <p className="mt-4 flex items-baseline gap-2">
                    <span className="text-[1.4rem] font-semibold tabular-nums text-true">
                      {bench.summary.matches} / {bench.cells.length}
                    </span>
                    <span className="text-[0.82rem] text-muted-foreground">cells reproduced</span>
                  </p>
                </div>

                <div className="tool p-5">
                  <h3 className="text-[0.95rem] font-semibold">2024 G20 Rio</h3>
                  <p className="mt-2 text-[0.86rem] leading-6 text-muted-foreground">
                    Imported from the published G20 Research Group reports. The reports cover only
                    the commitments selected for monitoring, so the corpus stays deliberately
                    partial rather than inventing the rest.
                  </p>
                  <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
                    <div>
                      <dt className="label">Commitments</dt>
                      <dd className="mt-1 text-[0.95rem] font-medium tabular-nums">
                        {rio.counts.selectedCommitments} of {rio.counts.expectedInventory}
                      </dd>
                    </div>
                    <div>
                      <dt className="label">Assessments</dt>
                      <dd className="mt-1 text-[0.95rem] font-medium tabular-nums">
                        {rio.counts.memberAssessments}
                      </dd>
                    </div>
                    <div>
                      <dt className="label">In review</dt>
                      <dd className="mt-1 text-[0.95rem] font-medium tabular-nums">
                        {rio.counts.reviewItems}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <p className="mt-5 max-w-[66ch] text-[0.88rem] leading-7 text-muted-foreground">
                The Rio reconciliation is recorded as incomplete on purpose.{" "}
                {rio.counts.reviewItems} items sit in the review queue rather than being resolved by
                guesswork, and every imported score keeps the label authority it came with.
              </p>
            </Section>

            {/* 6 · Reproducibility */}
            <Section
              id="reproducible"
              label="Reproducibility"
              heading="Every number carries its own proof."
            >
              <Prose className="mt-5">
                Each result is content-hashed over its methodology, its evidence snapshot, and the
                interpretation applied. Anyone with the same frozen record recomputes the same
                number and the same hash. Change one quoted word and the hash changes.
              </Prose>

              {sampleHash ? (
                <div className="tool mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
                  <span className="label">Receipt, recomputed now</span>
                  <HashPill hash={sampleHash} chars={10} />
                  {verified ? (
                    <span className="inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-true">
                      <Check aria-hidden className="size-3.5" />
                      Verified
                    </span>
                  ) : null}
                </div>
              ) : null}

              <h3 className="mt-10 text-[length:var(--t-h3)] leading-snug font-semibold">
                Conformance
              </h3>
              <p className="mt-3 max-w-[64ch] text-[0.9rem] leading-7 text-muted-foreground">
                The semantics are pinned by {totalCases} cases across {totalFiles} files. An
                implementation that disagrees with any of them is not Writ.
              </p>

              <ul className="mt-6 space-y-2.5">
                {areas.map((area) => (
                  <li key={area.id} className="flex items-center gap-4">
                    <span className="w-[9rem] shrink-0 text-[0.82rem] font-medium">
                      {area.title}
                    </span>
                    <span
                      aria-hidden
                      className="h-1.5 rounded-full bg-primary/50"
                      style={{ width: `${Math.round((area.cases / maxCases) * 60)}%` }}
                    />
                    <span className="text-[0.78rem] tabular-nums text-muted-foreground">
                      {area.cases}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-wrap gap-3">
                <Button
                  nativeButton={false}
                  render={
                    <Link href="/playground">
                      Run it yourself in the Writ Lab
                      <ArrowRight />
                    </Link>
                  }
                />
              </div>
            </Section>

            {/* 7 · FAQ */}
            <Section id="faq" label="Questions" heading="The honest answers, up front.">
              <div className="mt-8">
                <Faq />
              </div>
            </Section>
          </div>
        </div>
      </article>
    </main>
  );
}
