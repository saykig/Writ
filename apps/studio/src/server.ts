/**
 * The studio HTTP surface: a static file server for `public/` plus JSON
 * endpoints that run the real Covenant toolchain server-side.
 *
 * The request handler is exported as a pure `(Request) => Promise<Response>` so
 * tests can call it directly without binding a port. `src/index.ts` is the only
 * module that opens a socket.
 */

import { fileURLToPath } from "node:url";
import { analyze, benchmark, compile, evaluate, loadExamples } from "./toolchain.js";

/** Directory of browser assets served at the site root. */
const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" } as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function readSource(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    return body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Serve a file from `public/`, resolving `/` to `index.html`. */
async function serveStatic(pathname: string): Promise<Response> {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  // Reject traversal outside the public directory.
  if (relative.includes("..")) return new Response("Not found", { status: 404 });
  const file = Bun.file(`${PUBLIC_DIR}${relative}`);
  if (await file.exists()) {
    return new Response(file);
  }
  return new Response("Not found", { status: 404 });
}

/** Route one request. Pure and deterministic apart from reads of frozen data. */
export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/api/examples" && request.method === "GET") {
    return json({ examples: loadExamples() });
  }

  if (pathname === "/api/benchmark" && request.method === "GET") {
    return json(benchmark());
  }

  if (pathname === "/api/compile" && request.method === "POST") {
    const { source } = await readSource(request);
    if (typeof source !== "string") return json({ error: "Missing `source`." }, 400);
    return json(compile(source));
  }

  if (pathname === "/api/analyze" && request.method === "POST") {
    const { source } = await readSource(request);
    if (typeof source !== "string") return json({ error: "Missing `source`." }, 400);
    return json(analyze(source));
  }

  if (pathname === "/api/evaluate" && request.method === "POST") {
    const body = await readSource(request);
    const { source } = body;
    if (typeof source !== "string") return json({ error: "Missing `source`." }, 400);
    const member = typeof body.member === "string" ? body.member : "japan";
    const profile = typeof body.profile === "string" ? body.profile : "published";
    return json(evaluate(source, member, profile));
  }

  if (pathname.startsWith("/api/")) {
    return json({ error: "Unknown endpoint." }, 404);
  }

  if (request.method === "GET") {
    return serveStatic(pathname);
  }

  return new Response("Method not allowed", { status: 405 });
}
