import { evaluatePilot } from "@/lib/toolchain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { source?: unknown; member?: unknown };
  if (typeof body.source !== "string") {
    return Response.json({ error: "Missing `source`." }, { status: 400 });
  }
  const member = typeof body.member === "string" ? body.member : "eu";
  return Response.json(evaluatePilot(body.source, member));
}
