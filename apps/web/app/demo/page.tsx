import type { Metadata } from "next";

import { DemoWorkspace } from "@/components/demo/demo-workspace";
import { buildMemo, demoQuestions } from "@/lib/demo-memo";
import { policyTestDataset } from "@/lib/policy-test";

export const metadata: Metadata = {
  title: "Policy memos from reviewed records · Writ",
  description:
    "Three policy questions, each answered by a memo assembled from human-reviewed European Union and United States records, with every citation opening the record behind it.",
};

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const questions = demoQuestions();
  const requested = typeof params.q === "string" ? params.q : undefined;

  // Every memo is built here, so switching question is immediate rather than a
  // navigation. An unrecognised `q` falls back to the first question instead of
  // a not-found: the three questions are the whole surface.
  const memos = questions.map((question) => buildMemo(question.id)!);
  const initialQuestionId =
    requested && questions.some((question) => question.id === requested)
      ? requested
      : questions[0].id;

  return (
    <DemoWorkspace
      memos={memos}
      questions={questions.map((question) => ({
        id: question.id,
        question: question.question,
        kind: question.kind,
      }))}
      pilotQuestion={policyTestDataset().pilot_question}
      initialQuestionId={initialQuestionId}
    />
  );
}
