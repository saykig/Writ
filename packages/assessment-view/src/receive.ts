/** Operation receiver: reconstruct the permitted delta; never call applyRequest. */
import { sha256Canonical } from "@writ/provenance";
import { need, validateRequest, validateSnapshot } from "./contract.js";
export function receiveContinuation(base: unknown, request: unknown, candidate: unknown) {
  validateSnapshot(base);
  validateRequest(request, base);
  validateSnapshot(candidate);
  need(candidate.schema === base.schema, "HISTORY_REWRITTEN");
  need(sha256Canonical(candidate.packets) === sha256Canonical(base.packets), "HISTORY_REWRITTEN");
  need(candidate.events.length === base.events.length + 1, "EVENT_COUNT");
  for (let i = 0; i < base.events.length; i++)
    need(
      sha256Canonical(candidate.events[i]) === sha256Canonical(base.events[i]),
      "HISTORY_REWRITTEN",
    );
  need(sha256Canonical(candidate.events.at(-1)) === sha256Canonical(request), "REQUEST_MISMATCH");
  return {
    status: "checked" as const,
    scope:
      "exact declared continuation and preserved history; no empirical or mathematical interpretation checked",
    base_sha256: sha256Canonical(base),
    request_sha256: sha256Canonical(request),
    result_sha256: sha256Canonical(candidate),
  };
}
