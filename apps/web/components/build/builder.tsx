"use client";

/**
 * Build — a source passage becoming a structured record, without YAML.
 *
 * Five steps, all reachable at any time: this is a form for thinking with, not a
 * wizard that withholds the next question until the last one is answered. The
 * draft lives in this browser. Nothing here publishes, submits, opens a
 * contribution, syncs a repository or writes a file.
 */

import * as React from "react";

import type { BuildDraft } from "@/lib/build-draft";
import { BUILD_STEPS, type BuildStepId } from "@/lib/build-draft";
import type { BuildVocabulary } from "@/lib/build-vocabulary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDraft } from "./use-draft";
import { AddSource } from "./steps/add-source";
import { DefineCorpus } from "./steps/define-corpus";
import { ReviewRecord } from "./steps/review-record";
import { SelectPassage } from "./steps/select-passage";
import { Validate } from "./steps/validate";

const STEP_PURPOSE: Record<BuildStepId, string> = {
  corpus: "What this corpus covers, and which family it belongs to.",
  source: "The document the passage comes from, and the passage itself.",
  passage: "The words this record classifies.",
  record: "The record, in fields rather than prose.",
  validate: "What has been established, and what has not.",
};

export function Builder({ vocabulary }: { vocabulary: BuildVocabulary }) {
  const { draft, ready, update, save, saveState } = useDraft();
  const [stepIndex, setStepIndex] = React.useState(0);
  const step = BUILD_STEPS[stepIndex];

  const patch = React.useCallback(
    <K extends "corpus" | "source" | "record">(key: K, value: Partial<BuildDraft[K]>) => {
      update((current) => ({ ...current, [key]: { ...current[key], ...value } }));
    },
    [update],
  );

  return (
    <div className="mx-auto w-full max-w-[64rem] px-5 py-10 sm:px-6">
      <header>
        <p className="text-[0.66rem] tracking-[0.16em] uppercase text-muted-foreground">
          Corpus builder
        </p>
        <h1 className="mt-3 text-[length:var(--t-page)] leading-[1.06] font-semibold tracking-[-0.025em]">
          Build institutional knowledge
        </h1>
        <p className="mt-4 max-w-[62ch] text-[0.95rem] leading-7 text-muted-foreground">
          Turn one source passage into one structured draft record. The vocabulary is the reviewed
          corpus’s own, and the draft stays in this browser.
        </p>
      </header>

      <nav aria-label="Builder steps" className="mt-9">
        <ol className="flex flex-wrap gap-x-1 gap-y-2">
          {BUILD_STEPS.map((entry, index) => {
            const active = index === stepIndex;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => setStepIndex(index)}
                  className={cn(
                    "flex items-baseline gap-2 rounded-md px-3 py-2 text-left transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "bg-card text-foreground ring-1 ring-border"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <span className="text-[0.7rem] tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="text-[0.84rem]">{entry.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="mt-6 rounded-lg border border-border bg-card/30 px-5 py-6 sm:px-7 sm:py-8">
        <h2 className="text-[1.05rem] font-medium tracking-[-0.01em]">{step.title}</h2>
        <p className="mt-1 text-[0.78rem] leading-6 text-muted-foreground">
          {STEP_PURPOSE[step.id]}
        </p>

        <div className="mt-7">
          {!ready ? (
            <p className="text-[0.8rem] text-muted-foreground">Opening the draft workspace…</p>
          ) : step.id === "corpus" ? (
            <DefineCorpus
              draft={draft}
              vocabulary={vocabulary}
              onChange={(value) => patch("corpus", value)}
            />
          ) : step.id === "source" ? (
            <AddSource draft={draft} onChange={(value) => patch("source", value)} />
          ) : step.id === "passage" ? (
            <SelectPassage
              draft={draft}
              onChange={(selection) => update((current) => ({ ...current, selection }))}
            />
          ) : step.id === "record" ? (
            <ReviewRecord
              draft={draft}
              vocabulary={vocabulary}
              onChange={(value) => patch("record", value)}
            />
          ) : (
            <Validate
              draft={draft}
              saveState={saveState}
              onSave={save}
              onBack={() => setStepIndex(3)}
            />
          )}
        </div>
      </section>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          size="sm"
          variant="ghost"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
        >
          Back
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={stepIndex === BUILD_STEPS.length - 1}
          onClick={() => setStepIndex((index) => Math.min(BUILD_STEPS.length - 1, index + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
