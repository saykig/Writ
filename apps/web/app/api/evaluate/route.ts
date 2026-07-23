import { evaluate } from "@/lib/toolchain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    source?: unknown;
    member?: unknown;
    profile?: unknown;
  };
  if (typeof body.source !== "string") {
    return Response.json({ error: "Missing `source`." }, { status: 400 });
  }
  const member = typeof body.member === "string" ? body.member : "japan";
  const profile = typeof body.profile === "string" ? body.profile : "published";
  return Response.json(evaluate(body.source, member, profile));
}
