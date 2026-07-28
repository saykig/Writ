import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MemoView } from "@/components/demo/memo-view";
import { QuestionPicker } from "@/components/demo/question-picker";
import { buildMemo, demoQuestion, demoQuestions } from "@/lib/demo-memo";
import { policyTestDataset } from "@/lib/policy-test";
import { readRepoText } from "@/lib/repo";
import { REPO_PROVENANCE } from "@/lib/repo-provenance";

export const metadata: Metadata = {
  title: "Policy memos from reviewed records · Writ",
  description:
    "Choose a policy question and read a memo assembled from human-reviewed European Union and United States records, with every sentence traceable to its source.",
};

/** The profile a memo is produced under, offered verbatim as a download. */
const PROFILE_PATH = "pilot/eu-us-ai-evaluation/methodology/model-evaluation-duty.writ";

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const requested = typeof params.q === "string" ? params.q : undefined;

  // No question chosen: the three supported questions and nothing else.
  if (requested === undefined) {
    return (
      <QuestionPicker
        questions={demoQuestions().map((question) => ({
          id: question.id,
          question: question.question,
          kind: question.kind,
          description: question.description,
        }))}
        pilotQuestion={policyTestDataset().pilot_question}
      />
    );
  }

  if (!demoQuestion(requested)) notFound();
  const memo = buildMemo(requested);
  if (!memo) notFound();

  return (
    <MemoView
      memo={memo}
      provenance={REPO_PROVENANCE}
      profileSource={readRepoText(PROFILE_PATH)}
      profileFilename="model-evaluation-duty.writ"
    />
  );
}
