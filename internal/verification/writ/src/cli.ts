#!/usr/bin/env bun
import { renderVerification, verifyRepository, type VerificationSelection } from "./verify.js";

const argument = process.argv[2] ?? "all";
const aliases: Record<string, VerificationSelection> = {
  all: "all",
  ontology: "ontology",
  interoperability: "interoperability",
  interop: "interoperability",
  provenance: "provenance",
  integrity: "integrity",
};
const selection = aliases[argument];
if (!selection) {
  console.error(`Unknown verification gate: ${argument}`);
  process.exit(2);
}

const result = verifyRepository(selection);
console.log(renderVerification(result));
process.exit(result.passed ? 0 : 1);
