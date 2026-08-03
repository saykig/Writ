"use client";

/**
 * Query, as three columns.
 *
 * Preset questions on the left, always visible, so choosing one is a change of
 * reading rather than a step to be completed. The answer in the middle. The
 * record behind a citation on the right, closed until asked for and closable
 * again.
 *
 * The questions are preset because they are the ones the reviewed corpus can
 * answer. There is no free-text box: an answer here is assembled from records,
 * not searched for, and offering a search field would promise otherwise.
 *
 * Every answer is built on the server and held here, so switching question is
 * immediate and the reader never waits to see what another question says.
 */

import * as React from "react";

import type { MemoRecord } from "@/lib/demo-memo";
import type { QueryAnswer } from "@/lib/query-answer";
import { cn } from "@/lib/utils";
import { AboutPilot } from "./about-pilot";
import { AnswerDocument } from "./answer-document";
import { RecordPanel } from "./record-panel";

export interface QuestionEntry {
  id: string;
  question: string;
  kind: string;
}

export function QueryWorkspace({
  answers,
  questions,
  pilotQuestion,
  initialQuestionId,
}: {
  answers: QueryAnswer[];
  questions: QuestionEntry[];
  pilotQuestion: string;
  initialQuestionId: string;
}) {
  const [questionId, setQuestionId] = React.useState(initialQuestionId);
  const [openClaimId, setOpenClaimId] = React.useState<string | null>(null);

  const answer = answers.find((item) => item.questionId === questionId) ?? answers[0];
  const openRecord: MemoRecord | undefined = openClaimId
    ? answer.evidence.find((record) => record.claimId === openClaimId)
    : undefined;

  // A record is only meaningful beside its own answer, so changing question
  // closes the panel rather than leaving a record from the previous reading.
  function selectQuestion(id: string) {
    setQuestionId(id);
    setOpenClaimId(null);
  }

  const openNote = React.useCallback(
    (n: number) => {
      const record = answer.evidence.find((item) => item.n === n);
      if (record) setOpenClaimId(record.claimId);
    },
    [answer.evidence],
  );

  return (
    <main className="mx-auto w-full max-w-[92rem] px-4 py-8 sm:px-6 lg:py-10">
      <div
        className={cn(
          "grid gap-8 lg:gap-10",
          openRecord
            ? "lg:grid-cols-[14rem_minmax(0,1fr)_21rem]"
            : "lg:grid-cols-[14rem_minmax(0,1fr)]",
        )}
      >
        {/* Left: the questions, always in view. */}
        <nav aria-label="Policy questions" className="lg:sticky lg:top-20 lg:self-start">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            <h1 className="text-[0.68rem] tracking-[0.14em] uppercase text-muted-foreground">
              Policy questions
            </h1>
            <AboutPilot question={pilotQuestion} />
          </div>
          <p className="mt-2 text-[0.72rem] leading-6 text-muted-foreground">
            Questions the reviewed EU–US AI evaluation pilot can answer. Writ answers from this
            corpus, not from AI governance at large.
          </p>
          <ul className="mt-3 space-y-1">
            {questions.map((entry) => {
              const active = entry.id === questionId;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => selectQuestion(entry.id)}
                    className={cn(
                      "w-full rounded-md px-3 py-2.5 text-left transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active
                        ? "bg-card text-foreground ring-1 ring-border"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <span className="block text-[0.82rem] leading-6 text-balance">
                      {entry.question}
                    </span>
                    <span className="mt-1 block text-[0.62rem] tracking-[0.1em] uppercase text-muted-foreground/70">
                      {entry.kind}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Middle: the answer. */}
        <div className="min-w-0">
          <AnswerDocument
            answer={answer}
            onOpenNote={openNote}
            onOpenRecord={setOpenClaimId}
            activeClaimId={openClaimId}
          />
        </div>

        {/* Right: the record, when one is open. */}
        {openRecord ? (
          <RecordPanel record={openRecord} onClose={() => setOpenClaimId(null)} />
        ) : null}
      </div>
    </main>
  );
}
