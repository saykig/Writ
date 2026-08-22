// Typed repositories layer. `createRepositories(sql)` returns one repository per
// aggregate; the DATA-002 command API builds on this surface. Every repository
// accepts the same `DbClient`, so a caller can pass either the shared pool or a
// reserved connection (e.g. a hermetic temp-schema test connection).
import type { DbClient } from "../client.js";
import { actionsRepository } from "./actions.js";
import { auditRepository } from "./audit.js";
import { claimsRepository } from "./claims.js";
import { corpusRepository } from "./corpus.js";
import { documentsRepository } from "./documents.js";
import { institutionsRepository } from "./institutions.js";
import { reviewsRepository } from "./reviews.js";
import { sourceRegistryRepository } from "./sourceRegistry.js";

export function createRepositories(sql: DbClient) {
  return {
    institutions: institutionsRepository(sql),
    documents: documentsRepository(sql),
    claims: claimsRepository(sql),
    actions: actionsRepository(sql),
    reviews: reviewsRepository(sql),
    audit: auditRepository(sql),
    sourceRegistry: sourceRegistryRepository(sql),
    corpus: corpusRepository(sql),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export * from "./actions.js";
export * from "./audit.js";
export * from "./claims.js";
export * from "./corpus.js";
export * from "./documents.js";
export * from "./institutions.js";
export * from "./reviews.js";
export * from "./sourceRegistry.js";
export { one, maybe } from "./shared.js";
export type { DbClient, Queryable } from "./shared.js";
