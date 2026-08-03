import type { Metadata } from "next";

import { QueryWorkspace } from "@/components/query/query-workspace";
import { buildMemo, demoQuestions } from "@/lib/demo-memo";
import {
  DEMO_ANALYSIS_CORPORA,
  DEMO_ANALYSIS_SOURCE,
  demoAnalysisDataset,
  demoAnalysisReceipt,
} from "@/lib/demo-analysis";
import { answerFromMemo } from "@/lib/query-answer";

export const metadata: Metadata = {
  title: "Ask a question · Writ",
  description:
    "Preset questions over the reviewed European Union and United States AI evaluation pilot, each answered from the records themselves, with every citation opening the source behind it.",
};

export default async function QueryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const questions = demoQuestions();
  const requested = typeof params.q === "string" ? params.q : undefined;

  // Every answer is built here, so switching question is immediate rather than a
  // navigation. An unrecognised `q` falls back to the first question instead of
  // a not-found: the preset questions are the whole surface.
  const dataset = demoAnalysisDataset();
  const versions = {
    datasetSource: DEMO_ANALYSIS_SOURCE,
    corpusPaths: DEMO_ANALYSIS_CORPORA,
    schemaVersion: dataset.schema_version,
    reviewStatus: dataset.review_status,
    receiptHash: demoAnalysisReceipt().contentHash,
  };
  const answers = questions.map((question) => answerFromMemo(buildMemo(question.id)!, versions));
  const initialQuestionId =
    requested && questions.some((question) => question.id === requested)
      ? requested
      : questions[0].id;

  return (
    <QueryWorkspace
      answers={answers}
      questions={questions.map((question) => ({
        id: question.id,
        question: question.question,
        kind: question.kind,
      }))}
      pilotQuestion={demoAnalysisDataset().pilot_question}
      initialQuestionId={initialQuestionId}
    />
  );
}
