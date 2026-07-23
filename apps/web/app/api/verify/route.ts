import { verify } from "@/lib/toolchain";
import type { EvaluationReceipt } from "@writ/domain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { receipt?: unknown };
  if (typeof body.receipt !== "object" || body.receipt === null) {
    return Response.json({ error: "Missing `receipt`." }, { status: 400 });
  }
  return Response.json(verify(body.receipt as EvaluationReceipt));
}
