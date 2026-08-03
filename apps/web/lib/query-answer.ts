/**
 * A memo, read as an answer.
 *
 * A projection and nothing more: it reorders what `buildMemo` already produced
 * into the five parts a reader of an answer expects, and computes no new
 * finding. Every sentence, citation and record here came out of the memo
 * builder, so the answer cannot say something the reviewed records do not.
 *
 * The five parts, and why each is separate:
 *
 *   1. Answer — the finding, with its citations intact.
 *   2. Important distinctions — the four dimensions the corpus keeps apart. They
 *      are the answer's conditions, not decoration; collapsing any of them is
 *      what turns voluntary guidance into a binding duty.
 *   3. Evidence used — every record drawn on, cited or not.
 *   4. Uncertainty and limits — what is unknown, what is untraced, what was left
 *      out. Reported as counts; there is no score and no percentage.
 *   5. Corpus and query versions — what a citation would have to name.
 */

import type { Memo, MemoRecord, MemoSentence } from "./demo-memo.js";

export interface AnswerBlock {
  id: string;
  heading: string;
  purpose: string;
  paragraphs: readonly MemoSentence[][];
}

export interface QueryAnswer {
  questionId: string;
  question: string;
  title: string;
  kind: string;
  /** The executive finding and the conclusion, read as one run. */
  answer: readonly MemoSentence[];
  distinctions: readonly AnswerBlock[];
  evidence: readonly MemoRecord[];
  uncertainty: {
    /** Records whose enforcement the reviewers recorded as unknown. */
    unknownEnforcement: readonly string[];
    /** Records not yet traced to a source document. */
    untraced: readonly string[];
    selected: number;
    corpus: number;
    documents: number;
  };
  versions: {
    datasetId: string;
    profileId: string;
    datasetSource: string;
    corpusPaths: Readonly<Record<"EU" | "US", string>>;
    schemaVersion: string;
    reviewStatus: string;
    receiptHash: string;
  };
}

export interface AnswerVersions {
  datasetSource: string;
  corpusPaths: Readonly<Record<"EU" | "US", string>>;
  schemaVersion: string;
  reviewStatus: string;
  receiptHash: string;
}

export function answerFromMemo(memo: Memo, versions: AnswerVersions): QueryAnswer {
  return {
    questionId: memo.questionId,
    question: memo.question,
    title: memo.title,
    kind: memo.kind,
    answer: [...memo.executive, ...memo.conclusion],
    distinctions: memo.sections.map((section) => ({
      id: section.id,
      heading: section.heading,
      purpose: section.purpose,
      paragraphs: section.paragraphs,
    })),
    evidence: memo.records,
    uncertainty: {
      // `enforcementStatus` is carried raw through the memo, so `unknown`
      // arrives here as the reviewers recorded it.
      unknownEnforcement: memo.records
        .filter((record) => record.enforcementStatus === "unknown")
        .map((record) => record.claimId),
      untraced: memo.coverage.untraced,
      selected: memo.coverage.selected,
      corpus: memo.coverage.corpus,
      documents: memo.coverage.documents,
    },
    versions: {
      datasetId: memo.datasetId,
      profileId: memo.profileId,
      ...versions,
    },
  };
}
