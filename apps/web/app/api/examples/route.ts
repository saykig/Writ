import { loadPilotExamples } from "@/lib/toolchain";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ examples: loadPilotExamples() });
}
