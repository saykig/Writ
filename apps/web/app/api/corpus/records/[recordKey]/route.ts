import { NextResponse } from "next/server";

import { CORPUS_RECORD_DETAIL_BY_KEY } from "@/lib/corpus-record-detail-data";

/** One read-only canonical record detail. No querying, evaluation or fallback. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recordKey: string }> },
) {
  const { recordKey } = await params;
  const detail = CORPUS_RECORD_DETAIL_BY_KEY[recordKey];
  if (!detail) {
    return NextResponse.json(
      { error: "That record is not present in the current corpus." },
      { status: 404 },
    );
  }
  return NextResponse.json(detail);
}
