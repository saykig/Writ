"use client";

/**
 * Step one: choose a question.
 *
 * Three supported questions and no free-text box, because the memo is assembled
 * from reviewed records rather than searched for. Offering an open field would
 * promise an answer the corpus cannot give.
 *
 * Selecting one shows, briefly, what is actually happening: the memo is being
 * built from reviewed profiles and source records, not written on demand.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { AboutPilot } from "./about-pilot";

export interface QuestionCard {
  id: string;
  question: string;
  kind: string;
  description: string;
}

export function QuestionPicker({
  questions,
  pilotQuestion,
}: {
  questions: readonly QuestionCard[];
  pilotQuestion: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  function choose(id: string) {
    setPending(id);
    router.push(`/demo?q=${id}`);
  }

  const chosen = questions.find((question) => question.id === pending);

  if (chosen) {
    return (
      <div
        className="mx-auto flex min-h-[60vh] w-full max-w-[42rem] flex-col justify-center px-5 py-16"
        aria-live="polite"
      >
        <p className="text-[0.7rem] tracking-[0.12em] uppercase text-muted-foreground">
          {chosen.kind}
        </p>
        <p className="mt-3 text-[1.05rem] leading-8 text-foreground text-balance">
          {chosen.question}
        </p>
        <p className="mt-6 text-[0.88rem] leading-7 text-muted-foreground">
          Building this memo from reviewed Writ profiles and source records.
        </p>
        <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] text-muted-foreground">
          {["Question", "reviewed claims", "structured judgment", "policy memo"].map(
            (step, index) => (
              <li key={step} className="flex items-center gap-2">
                {index > 0 ? (
                  <ArrowRight aria-hidden className="size-3 text-muted-foreground/50" />
                ) : null}
                <span>{step}</span>
              </li>
            ),
          )}
        </ol>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[46rem] px-5 py-14 sm:px-6 sm:py-20">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <h1 className="text-[1.5rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[1.75rem]">
          Choose a policy question to test
        </h1>
        <AboutPilot question={pilotQuestion} />
      </div>

      <div className="mt-10 space-y-3">
        {questions.map((question) => (
          <button
            key={question.id}
            type="button"
            onClick={() => choose(question.id)}
            className={cn(
              "group flex w-full flex-col gap-2 rounded-xl border border-border bg-card/40 px-6 py-6 text-left transition-colors",
              "hover:border-foreground/25 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            <span className="flex items-start justify-between gap-4">
              <span className="text-[1.02rem] leading-7 font-medium text-balance">
                {question.question}
              </span>
              <ArrowRight
                aria-hidden
                className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </span>
            <span className="text-[0.82rem] leading-6 text-muted-foreground">
              {question.description}
            </span>
            <span className="text-[0.68rem] tracking-[0.1em] uppercase text-muted-foreground/70">
              {question.kind}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
