import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CodeArtifact } from "@/components/site/code-artifact";
import { HashPill } from "@/components/site/hash-pill";
import { PageHeader } from "@/components/site/page-header";
import { Pipeline } from "@/components/site/pipeline";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { TruthBadge, type TruthBadgeValue } from "@/components/site/truth-badge";
import { ArchitectureDiagram } from "@/components/how-it-works/architecture-diagram";
import { EssayIndex, type EssaySection } from "@/components/how-it-works/essay-index";
import { Faq } from "@/components/how-it-works/faq";
import { POLICY_TEST_HREF } from "@/lib/policy-test";
import { loadCoverage } from "@/lib/conformance";
import { compile, evaluateMember, exampleSource, verify } from "@/lib/toolchain";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "How it works · Writ",
  description:
    "How Writ turns a written policy methodology into a typed program, runs it against reviewed evidence, and returns a receipt anyone can recompute.",
};

const SECTIONS: readonly EssaySection[] = [
  { id: "pipeline", title: "The pipeline" },
  { id: "truth", title: "Four-valued truth" },
  { id: "language", title: "The language" },
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

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className="mt-1.5 text-[0.9rem] font-medium break-words">{children}</dd>
    </div>
  );
}

export default function HowItWorksPage() {
  // Compiled on this request, so the figures below are the real ones.
  const literalSource = exampleSource("literal") ?? "";
  const ir = compile(literalSource).ir;
  const commitment = ir?.commitments[0];

  let sampleHash: string | undefined;
  let verified = false;
  try {
    const receipt = evaluateMember("japan", "published");
    sampleHash = receipt?.canonical_hash;
    if (receipt) verified = verify(receipt).valid;
  } catch {
    sampleHash = undefined;
  }

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
            note="The pipeline, its logic, its language, and what makes a result reproducible."
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
                and how actions are counted are all declared, so the analyzer can find a gap in the
                rubric before any evidence is gathered.
              </Prose>

              <div className="mt-8">
                <CodeArtifact
                  code={literalSource}
                  label="Methodology"
                  filename="2025-ai-sme-literal.writ"
                />
              </div>

              {commitment ? (
                <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
                  <Fact label="Package">
                    <span className="font-mono text-[0.8rem]">{ir?.package.name}</span>
                  </Fact>
                  <Fact label="Variables">
                    <span className="tabular-nums">{commitment.variables.length}</span>
                  </Fact>
                  <Fact label="Parameters">
                    <span className="tabular-nums">{commitment.parameters.length}</span>
                  </Fact>
                  <Fact label="Score rules">
                    <span className="tabular-nums">{commitment.score_program.rules.length}</span>
                  </Fact>
                  <Fact label="Counting policy">
                    <span className="font-mono text-[0.8rem]">
                      {commitment.action_identity.policy}
                    </span>
                  </Fact>
                </dl>
              ) : null}

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

            {/* 4 · Reproducibility */}
            <Section
              id="reproducible"
              label="Reproducibility"
              heading="A score is only as trustworthy as the evidence beneath it."
            >
              <Prose className="mt-5">
                Every result is content-hashed over its methodology, its evidence snapshot, and the
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

              <div className="mt-9">
                <Button
                  nativeButton={false}
                  render={
                    <Link href={POLICY_TEST_HREF}>
                      See it run on a reviewed policy question
                      <ArrowRight />
                    </Link>
                  }
                />
              </div>
            </Section>

            {/* 5 · FAQ */}
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
