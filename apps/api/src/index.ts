// Application entry point for @covenant/api.
//
// The evidence-ledger database layer (schema/migrations DATA-001 and the source
// registry service DATA-004). The Fastify command API (DATA-002) builds on the
// repositories exported here.
export * from "./db/index.js";
