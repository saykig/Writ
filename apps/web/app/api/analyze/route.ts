import { analyze } from "@/lib/toolchain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { source?: unknown };
  if (typeof body.source !== "string") {
    return Response.json({ error: "Missing `source`." }, { status: 400 });
  }
  return Response.json(analyze(body.source));
}
