import type { Metadata } from "next";

import { CorpusBrowser } from "@/components/corpus/corpus-browser";
import { CORPUS_RECORD_INDEX } from "@/lib/corpus-record-index-data";

export const metadata: Metadata = {
  title: "Corpus · Writ",
  description: "Browse the records and evidence currently structured in Writ.",
};

export default async function CorpusPage({
  searchParams,
}: {
  searchParams: Promise<{ record?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialRecordKey = typeof params.record === "string" ? params.record : null;
  return <CorpusBrowser records={CORPUS_RECORD_INDEX} initialRecordKey={initialRecordKey} />;
}
