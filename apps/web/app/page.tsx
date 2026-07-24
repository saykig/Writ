import Link from "next/link";
import {
  ArrowRight,
  Code2,
  Database,
  Eye,
  FileText,
  Fingerprint,
  GitBranch,
  ListChecks,
  ReceiptText,
  Repeat2,
  Scale,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";

import { benchmark, evaluateMember, memberSnapshot } from "@/lib/toolchain";
import { g7AssessmentPreviews } from "@/lib/g7-assessments";
import { G7GlobeSelector } from "@/components/g7/g7-globe-selector";
import { Reveal } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";
import { TruthBadge } from "@/components/site/truth-badge";
import type { TruthBadgeValue } from "@/components/site/truth-badge";

const PROCESS = [
  {
    icon: FileText,
    title: "Methodology in prose",
    text: "Start with an existing policy evaluation framework.",
  },
  {
    icon: ListChecks,
    title: "Explicit rules",
    text: "Define its criteria, thresholds, and unresolved cases precisely.",
  },
  {
    icon: SearchCheck,
    title: "Reviewed evidence",
    text: "Apply the rules only to evidence that has been sourced and reviewed.",
  },
  {
    icon: ShieldCheck,
    title: "Assessment receipt",
    text: "Return the result with the rule, evidence, interpretation, and version used.",
  },
] as const;

const PRINCIPLES = [
  {
    icon: Eye,
    title: "Transparent",
    text: "See which rule was applied, which evidence was used, and how the result was interpreted.",
  },
  {
    icon: Repeat2,
    title: "Consistent",
    text: "Apply the same methodology the same way, every time.",
  },
  {
    icon: Fingerprint,
    title: "Auditable",
    text: "Record every decision with sources, versions, and content hashes.",
  },
  {
    icon: Scale,
    title: "Meaningful",
    text: "Preserve true, false, unknown, and contested evidence without forcing false precision.",
  },
] as const;

const CAPABILITIES = [
  { icon: Code2, text: "A dedicated language for policy evaluation" },
  { icon: Database, text: "Designed for frozen, reviewed evidence" },
  { icon: GitBranch, text: "Static checks for gaps and conflicts" },
  { icon: ReceiptText, text: "Deterministic receipts for every assessment" },
] as const;

export default function Home() {
  const bench = benchmark();
  const canada = bench.cells.find((cell) => cell.member === "canada");
  const receipt = evaluateMember("canada", "published");
  const snapshot = memberSnapshot("canada");
  const g7Members = g7AssessmentPreviews();

  return (
    <main>
      <Reveal as="section" className="min-h-[calc(100svh-4.5rem)]">
        <div className="mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-[76rem] items-center gap-4 px-5 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(30rem,1.12fr)] lg:py-8 min-[1400px]:max-w-[92rem] min-[1400px]:grid-cols-[minmax(24rem,1fr)_58rem]">
          <div className="relative z-10 py-4 lg:py-10">
            <h1 className="whitespace-nowrap text-[length:var(--t-hero)] leading-[0.98] font-semibold tracking-[-0.04em]">
              Write in Writ.
            </h1>
            <p className="mt-7 max-w-[36rem] text-[length:var(--t-lead)] leading-8 text-muted-foreground text-pretty">
              Writ is a Domain-Specific Language (DSL) for expressing rule-based policy evaluation
              methodologies over reviewed evidence and producing reproducible assessment receipts.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="text-[0.78rem] sm:text-[0.82rem]"
                nativeButton={false}
                render={
                  <Link href="/benchmark">
                    See how it works with 2025 G7 Commitments
                    <ArrowRight />
                  </Link>
                }
              />
              <Button
                variant="outline"
                size="lg"
                nativeButton={false}
                render={<Link href="/playground">Try Writ</Link>}
              />
            </div>
          </div>

          <div className="mx-auto w-full max-w-[42rem] lg:justify-self-end min-[1400px]:max-w-[58rem]">
            <G7GlobeSelector members={g7Members} />
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="bg-card/25">
        <div className="mx-auto grid max-w-[76rem] items-start gap-8 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <h2 className="text-[length:var(--t-h2)] leading-[1.08]">
              From ambiguous prose to reviewable decisions.
            </h2>
          </div>
          <div className="max-w-[64ch] space-y-5 text-[length:var(--t-lead)] leading-8 text-muted-foreground">
            <p>
              Compliance methods are usually written for people to interpret. That can leave
              uncertainty about which rule takes priority, or how missing evidence should be
              handled.
            </p>
            <p>
              Writ turns the method into a clear set of rules before producing a result. It checks
              whether those rules conflict or leave cases unresolved, then applies them to a fixed
              body of reviewed evidence. When the evidence is not enough, Writ does not guess.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6 lg:py-28">
        <h2 className="text-center text-[length:var(--t-h2)] leading-[1.08] font-semibold">
          The Writ process
        </h2>
        <div className="relative mt-14 grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          <div
            className="pointer-events-none absolute top-8 right-[12.5%] left-[12.5%] hidden h-px bg-border lg:block"
            aria-hidden
          >
            <span className="absolute top-1/2 left-[16.666%] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground" />
            <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground" />
            <span className="absolute top-1/2 left-[83.333%] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground" />
          </div>
          {PROCESS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="relative px-0 text-center sm:px-5 lg:px-8">
                <span className="relative mx-auto flex size-16 items-center justify-center rounded-full border border-border bg-background text-primary">
                  <Icon className="size-7" strokeWidth={1.7} />
                </span>
                <p className="mt-7 text-sm font-semibold">
                  {index + 1}. {step.title}
                </p>
                <p className="mx-auto mt-3 max-w-[15rem] text-sm leading-6 text-muted-foreground">
                  {step.text}
                </p>
              </div>
            );
          })}
        </div>
      </Reveal>

      <Reveal as="section" className="bg-card/25">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6 lg:py-28">
          <h2 className="text-center text-[length:var(--t-h2)] leading-[1.08] font-semibold">
            Why Writ
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Policy evaluations should be transparent, consistent, and auditable.
          </p>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {PRINCIPLES.map((principle) => {
              const Icon = principle.icon;
              return (
                <div
                  key={principle.title}
                  className="px-0 sm:px-5 lg:px-8 lg:not-first:border-l lg:not-first:border-border"
                >
                  <Icon className="size-5 text-primary" />
                  <h3 className="mt-5 text-base font-semibold">{principle.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{principle.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6 lg:py-28">
        <div className="grid overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[1fr_0.9fr]">
          <div className="p-7 sm:p-10 lg:p-12">
            <p className="text-sm font-medium text-primary">See it in action</p>
            <h2 className="mt-4 max-w-[20ch] text-[length:var(--t-h2)] leading-[1.08]">
              How Writ reproduces a G7 compliance assessment
            </h2>
            <p className="mt-5 max-w-[58ch] text-base leading-7 text-muted-foreground">
              Explore the checked-in 2025 G7 AI-for-SMEs fixture: one published methodology, eight
              member assessments, frozen evidence, and reproducible results.
            </p>
            <Button
              className="mt-8"
              nativeButton={false}
              render={
                <Link href="/benchmark">
                  Explore the G7 example
                  <ArrowRight />
                </Link>
              }
            />
          </div>

          <div className="border-t border-border bg-background/40 p-7 sm:p-10 lg:border-t-0 lg:border-l">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">AI adoption by SMEs</p>
                <p className="mt-1 text-sm text-muted-foreground">Canada · 2025 fixture</p>
              </div>
              {canada ? <TruthBadge value={canada.published as TruthBadgeValue} /> : null}
            </div>
            <dl className="mt-8 divide-y divide-border border-y border-border text-sm">
              <div className="flex justify-between gap-5 py-3">
                <dt className="text-muted-foreground">Published result</dt>
                <dd>{canada?.published ?? "Unavailable"}</dd>
              </div>
              <div className="flex justify-between gap-5 py-3">
                <dt className="text-muted-foreground">Computed result</dt>
                <dd>{canada?.computed ?? "Unavailable"}</dd>
              </div>
              <div className="flex justify-between gap-5 py-3">
                <dt className="text-muted-foreground">Result status</dt>
                <dd>{receipt?.result_status ?? "Unavailable"}</dd>
              </div>
              <div className="flex justify-between gap-5 py-3">
                <dt className="text-muted-foreground">Reviewed actions</dt>
                <dd>{snapshot?.actions.length ?? "Unavailable"}</dd>
              </div>
            </dl>
            <Link
              href="/benchmark"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              View the benchmark
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </Reveal>

      <Reveal as="section">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <h2 className="text-center text-[length:var(--t-h2)] leading-[1.08] font-semibold">
            Built for rigorous policy evaluation
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Writ brings clarity and structure to complex policy assessments.
          </p>
          <div className="mt-12 flex flex-wrap justify-center gap-x-10 gap-y-7">
            {CAPABILITIES.map((capability) => {
              const Icon = capability.icon;
              return (
                <div
                  key={capability.text}
                  className="flex max-w-[16rem] items-center gap-4 text-sm leading-6"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span>{capability.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>
    </main>
  );
}
