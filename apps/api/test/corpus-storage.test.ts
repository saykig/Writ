import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Sql } from "../src/db/client.js";
import { corpusRepository, prepareCorpusArtifact } from "../src/db/repositories/corpus.js";
import { sourceRegistryRepository } from "../src/db/repositories/sourceRegistry.js";
import { createTempDb, createTestSql, hasDatabase, type TempDb } from "./testdb.js";

const input = {
  logicalId: "corpus.manifest.g20.2024-rio",
  sourceId: "g20_research_group",
  objectKind: "source_manifest" as const,
  content: new TextEncoder().encode('{"blocked":true}\n'),
  mediaType: "application/json",
  schemaVersion: "1.0.0",
  summitSlug: "2024-rio",
  provenance: { phase: "1A", live_fetch_authorized: false },
};

test("corpus artifact identity is deterministic and content-addressed", () => {
  const first = prepareCorpusArtifact(input);
  const second = prepareCorpusArtifact(input);
  expect(first.artifactSha256).toBe(second.artifactSha256);
  expect(first.objectId).toBe(second.objectId);
  expect(first.byteSize).toBe(input.content.byteLength);
});

const suite = hasDatabase ? describe : describe.skip;

suite("online corpus artifact store", () => {
  let pool: Sql | undefined;
  let db: TempDb;

  beforeAll(async () => {
    pool = createTestSql({ max: 3 });
    db = await createTempDb(pool);
    await sourceRegistryRepository(db.sql).importEntry({
      id: "g20_research_group",
      name: "G20 Research Group",
      publisher: "University of Toronto",
      jurisdictions: ["G20"],
      source_tier: 1,
      source_types: ["commitment_inventory"],
      base_uri: "https://example.invalid",
      discovery_method: "seed_index",
      fetch_method: "manual_review",
      authentication: { type: "none" },
      terms_status: "review_required",
      robots_policy: "manual_review",
      enabled: false,
      verification_status: "verify_before_enable",
    });
  });

  afterAll(async () => {
    await db?.drop();
    await pool?.end({ timeout: 5 });
  });

  test("repeated publication is idempotent and changed bytes create a version", async () => {
    const repository = corpusRepository(db.sql);
    const first = await repository.publish(input);
    const repeated = await repository.publish(input);
    const changed = await repository.publish({
      ...input,
      content: new TextEncoder().encode('{"blocked":true,"revision":2}\n'),
    });

    expect(first.created).toBe(true);
    expect(repeated.created).toBe(false);
    expect(changed.created).toBe(true);
    expect(changed.supersedesObjectId).toBe(first.objectId);
    expect(await repository.current(input.sourceId)).toHaveLength(1);
    const stored = await repository.readCurrent(input.logicalId);
    expect(new TextDecoder().decode(stored!.content)).toBe('{"blocked":true,"revision":2}\n');
  });

  test("published corpus bytes and object metadata are immutable", async () => {
    const repository = corpusRepository(db.sql);
    const [current] = await repository.current(input.sourceId);
    expect(current).toBeDefined();
    await db.sql`SET statement_timeout TO '2s'`;

    const failureMessage = async (query: Promise<unknown>): Promise<string> => {
      try {
        await query;
        return "";
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    };
    const objectFailure = await failureMessage(
      db.sql`UPDATE corpus_objects SET summit_slug = 'changed' WHERE id = ${current!.id}`,
    );
    const blobFailure = await failureMessage(
      db.sql`DELETE FROM corpus_blobs WHERE sha256 = ${current!.artifact_sha256}`,
    );
    expect(objectFailure).toContain("immutable");
    expect(blobFailure).toContain("immutable");
  });
});
