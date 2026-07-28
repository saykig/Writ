"use client";

/**
 * The Demo, as three columns.
 *
 * Questions on the left, always visible, so choosing one is a change of reading
 * rather than a step to be completed. The memo in the middle. The record behind
 * a citation on the right, closed until asked for and closable again.
 *
 * All three memos are built on the server and held here, so switching question
 * is immediate and the reader never waits to see what another question says.
 */

import * as React from "react";

import type { Memo, MemoRecord } from "@/lib/demo-memo";
import { cn } from "@/lib/utils";
import { AboutPilot } from "./about-pilot";
import { MemoDocument } from "./memo-document";
import { RecordPanel } from "./record-panel";

export interface QuestionEntry {
  id: string;
  question: string;
  kind: string;
}

export function DemoWorkspace({
  memos,
  questions,
  pilotQuestion,
  initialQuestionId,
}: {
  memos: Memo[];
  questions: QuestionEntry[];
  pilotQuestion: string;
  initialQuestionId: string;
}) {
  const [questionId, setQuestionId] = React.useState(initialQuestionId);
  const [openClaimId, setOpenClaimId] = React.useState<string | null>(null);

  const memo = memos.find((item) => item.questionId === questionId) ?? memos[0];
  const openRecord: MemoRecord | undefined = openClaimId
    ? memo.records.find((record) => record.claimId === openClaimId)
    : undefined;

  // A record is only meaningful beside its own memo, so changing question
  // closes the panel rather than leaving a record from the previous reading.
  function selectQuestion(id: string) {
    setQuestionId(id);
    setOpenClaimId(null);
  }

  const openNote = React.useCallback(
    (n: number) => {
      const record = memo.records.find((item) => item.n === n);
      if (record) setOpenClaimId(record.claimId);
    },
    [memo.records],
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

        {/* Middle: the memo. */}
        <div className="min-w-0">
          <MemoDocument
            memo={memo}
            onOpenNote={openNote}
            onOpenRecord={setOpenClaimId}
            activeClaimId={openClaimId}
          />
        </div>

        {/* Right: the record, when one is open. */}
        {openRecord ? (
          <RecordPanel
            record={openRecord}
            questionId={memo.questionId}
            onClose={() => setOpenClaimId(null)}
          />
        ) : null}
      </div>
    </main>
  );
}
