import { ArrowDown, Check, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

const STAGES = ["Source", "Passage", "Record", "Corpus", "Question", "Answer + trace"] as const;

function PipelineMap() {
  return (
    <nav aria-label="Writ evidence pipeline" className="mt-12 border-y border-border py-5">
      <ol className="grid grid-cols-1 gap-0 sm:grid-cols-6">
        {STAGES.map((stage, index) => (
          <li
            key={stage}
            className="flex min-w-0 items-center gap-3 py-2 sm:flex-col sm:items-start sm:gap-2 sm:border-l sm:border-border sm:px-4 sm:py-0 first:sm:border-l-0 first:sm:pl-0"
          >
            <span className="font-mono text-[0.62rem] text-primary" aria-hidden>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-[0.78rem] font-medium text-foreground">{stage}</span>
            {index < STAGES.length - 1 ? (
              <ArrowDown
                aria-hidden
                className="ml-auto size-3 text-muted-foreground sm:ml-0 sm:rotate-[-90deg]"
              />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StageShell({
  index,
  title,
  explanation,
  children,
}: {
  index: number;
  title: string;
  explanation: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`start-here-stage-${index}`}
      className="relative grid min-h-[auto] scroll-mt-24 content-center py-10 sm:py-14 lg:min-h-[72svh] lg:py-20"
    >
      <div className="relative ml-8 rounded-xl border border-border bg-card p-5 sm:ml-12 sm:p-7">
        <div
          aria-hidden
          className="absolute top-8 -left-[2.38rem] grid size-7 place-items-center rounded-full border border-primary bg-background font-mono text-[0.62rem] text-primary sm:-left-[3.4rem]"
        >
          {index + 1}
        </div>
        <p className="label">{title}</p>
        <div className="mt-5">{children}</div>
        <p className="mt-6 max-w-[56ch] text-[0.9rem] leading-7 text-muted-foreground">
          {explanation}
        </p>
      </div>
    </section>
  );
}

function SourceStage() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <FileText aria-hidden className="size-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">About NIST</p>
          <p className="mt-0.5 text-xs text-muted-foreground">nist.gov</p>
        </div>
      </div>
      <p className="max-w-[62ch] px-4 py-5 font-serif text-[0.95rem] leading-8 text-foreground">
        The National Institute of Standards and Technology (NIST) was founded in 1901 and is now
        part of the U.S. Department of Commerce.
      </p>
    </div>
  );
}

function PassageStage() {
  return (
    <blockquote className="max-w-[58ch] border-l border-border pl-5 font-serif text-[1.05rem] leading-9 text-foreground">
      <span className="text-muted-foreground/55">“NIST was founded in 1901 and </span>
      <mark className="rounded-[3px] bg-gold-wash px-1 py-0.5 text-foreground ring-1 ring-primary/35">
        is now part of the U.S. Department of Commerce
      </mark>
      <span className="text-muted-foreground/55">.”</span>
    </blockquote>
  );
}

function RecordStage() {
  return (
    <div className="mx-auto max-w-[27rem] rounded-lg border border-border bg-background p-5 text-center">
      <div className="flex items-center justify-between gap-3">
        <span className="label">Placement</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check aria-hidden className="size-3.5 text-true" /> reviewed
        </span>
      </div>
      <p className="mt-6 text-lg font-semibold">NIST</p>
      <ArrowDown aria-hidden className="mx-auto my-3 size-4 text-primary" />
      <p className="text-lg font-semibold">U.S. Department of Commerce</p>
      <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
        One record = one supported institutional fact.
      </p>
    </div>
  );
}

function CorpusStage() {
  return (
    <div className="mx-auto max-w-[31rem]">
      <p className="mb-3 text-sm font-medium">NIST institutional corpus</p>
      <div className="relative pb-5 pl-5">
        <div aria-hidden className="absolute inset-x-10 top-4 bottom-1 rounded-lg bg-muted" />
        <div
          aria-hidden
          className="absolute inset-x-5 top-2 bottom-3 rounded-lg border border-border bg-card"
        />
        <div className="relative rounded-lg border border-primary/45 bg-background p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="label">Placement record</span>
            <span className="font-mono text-[0.62rem] text-muted-foreground">reviewed</span>
          </div>
          <p className="mt-4 text-sm leading-6">
            NIST is organizationally situated within the U.S. Department of Commerce.
          </p>
        </div>
      </div>
    </div>
  );
}

function QuestionStage() {
  return (
    <div className="max-w-[38rem] border-y border-border py-7">
      <p className="text-xs text-muted-foreground">Ask the corpus</p>
      <p className="mt-3 text-[clamp(1.35rem,3vw,2rem)] leading-tight tracking-[-0.02em]">
        Where is NIST organizationally situated?
      </p>
    </div>
  );
}

function AnswerStage() {
  const trace = [
    ["Answer", "NIST is situated within the U.S. Department of Commerce."],
    ["Record", "nist_organizational_placement"],
    ["Source", "About NIST"],
    ["Passage", "“NIST … is now part of the U.S. Department of Commerce.”"],
  ] as const;

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)] lg:items-start">
      <div className="rounded-lg bg-primary px-5 py-6 text-primary-foreground">
        <p className="text-xs font-medium text-primary-foreground/70">Answer</p>
        <p className="mt-3 text-xl leading-8 font-medium">
          NIST is organizationally situated within the U.S. Department of Commerce.
        </p>
      </div>
      <ol aria-label="Evidence trace" className="space-y-0">
        {trace.map(([label, value], index) => (
          <li key={label} className="relative flex gap-3 pb-5 last:pb-0">
            {index < trace.length - 1 ? (
              <span aria-hidden className="absolute top-5 bottom-0 left-[0.31rem] w-px bg-border" />
            ) : null}
            <span
              aria-hidden
              className="relative mt-1.5 size-2.5 shrink-0 rounded-full border border-primary bg-background"
            />
            <div>
              <p className="text-[0.65rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                {label}
              </p>
              <p
                className={cn(
                  "mt-1 text-[0.78rem] leading-5 text-foreground",
                  label === "Record" && "font-mono text-[0.7rem]",
                )}
              >
                {value}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function StartHereWalkthrough() {
  return (
    <>
      <PipelineMap />

      <div className="relative mt-14 grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block" aria-label="Walkthrough progress">
          <div className="sticky top-28 py-6">
            <p className="label">One evidence thread</p>
            <ol className="mt-6 space-y-4">
              {STAGES.map((stage) => (
                <li key={stage} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                  {stage}
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <div className="relative">
          <span
            aria-hidden
            className="absolute top-10 bottom-10 left-[0.87rem] w-px bg-border sm:left-[1.36rem]"
          />
          <span
            aria-hidden
            className="absolute top-10 bottom-10 left-[0.87rem] w-px bg-primary sm:left-[1.36rem]"
          />

          <StageShell index={0} title="Source" explanation="Writ starts with the original source.">
            <SourceStage />
          </StageShell>
          <StageShell
            index={1}
            title="Passage"
            explanation="A specific passage is selected as evidence — not the whole webpage."
          >
            <PassageStage />
          </StageShell>
          <StageShell
            index={2}
            title="Record"
            explanation="The passage supports one small, reviewable institutional fact."
          >
            <RecordStage />
          </StageShell>
          <StageShell
            index={3}
            title="Corpus"
            explanation="Reviewed records are collected into corpora. A corpus is the knowledge Writ can reason over."
          >
            <CorpusStage />
          </StageShell>
          <StageShell
            index={4}
            title="Question"
            explanation="Now the structured knowledge can be asked a plain-language question."
          >
            <QuestionStage />
          </StageShell>
          <StageShell
            index={5}
            title="Answer + trace"
            explanation="The answer does not lose its evidence. You can always follow it back to the record, passage and original source."
          >
            <AnswerStage />
          </StageShell>
        </div>
      </div>
    </>
  );
}
