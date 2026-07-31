#!/usr/bin/env bash
# Historical G7 evaluator compatibility verification.
#
# This is not Writ's primary demonstration or a current corpus model. It retains
# the old AI-for-SMEs compile/analyze/reproduce flow solely to verify legacy
# evaluator and scoring behavior against frozen inputs.
#
# The inline `bun -e` snippets run from packages/benchmark, whose dependency set
# covers @writ/{language,provenance,evaluator,domain,analyzer,benchmark};
# repo files are referenced through $ROOT so cwd does not matter.
set -euo pipefail
cd "$(dirname "$0")/../../../../.."
ROOT="$PWD"
export ROOT
CLI() { bun "$ROOT/packages/cli/bin/writ.ts" "$@"; }
bench() { (cd "$ROOT/packages/benchmark" && bun -e "$1"); }
rule() { printf '\n\033[1m%s\033[0m\n' "════ $1 ════"; }

rule "1. LANGUAGE — compile Writ source to the canonical IR (golden hash)"
bench '
import { compileSource } from "@writ/language";
import { sha256Canonical } from "@writ/provenance";
import { readFileSync } from "node:fs";
const root = process.env.ROOT;
const fixture = root + "/internal/verification/fixtures/compatibility/g7-ai-sme";
const golden = JSON.parse(readFileSync(fixture + "/schemas/2025-ai-sme-literal.ir.json", "utf8"));
const r = compileSource(readFileSync(fixture + "/language/2025-ai-sme-literal.writ","utf8"), { fileName: "compatibility-fixture" });
console.log("  commitment:", r.ir.commitments[0].id);
console.log("  compiled IR == hand-authored golden IR:", sha256Canonical(r.ir) === sha256Canonical(golden) ? "yes (byte-identical after canonicalization)" : "NO");
'

rule "2. ANALYZER — catch the 'up to four strong actions' ambiguity BEFORE any evidence"
echo "  literal reading:"
CLI analyze "$ROOT/internal/verification/fixtures/compatibility/g7-ai-sme/language/2025-ai-sme-literal.writ" 2>&1 | grep -E "WRT-SCORE" | sed 's/^/    /' || true
echo "  resolved reading:"
CLI analyze "$ROOT/internal/verification/fixtures/compatibility/g7-ai-sme/language/2025-ai-sme-resolved.writ" 2>&1 | tail -1 | sed 's/^/    /'

rule "3. BENCHMARK — reproduce all 8 published G7 AI-for-SMEs scores from frozen evidence"
bench '
import { readFileSync } from "node:fs";
const l = JSON.parse(readFileSync(process.env.ROOT + "/internal/verification/benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/discrepancy-ledger.json","utf8"));
console.log("  summary:", JSON.stringify(l.summary));
for (const c of l.cells) console.log(`    ${c.member.padEnd(16)} published ${c.published}  computed ${c.computed}  ${c.match?"MATCH":"MISMATCH"}  ${c.category==="implicit_analyst_interpretation"?"[interpretation-sensitive]":""}`);
'

rule "4. RECEIPT — deterministic, and tamper-evident"
bench '
import { runBenchmark } from "@writ/benchmark";
import { writeFileSync } from "node:fs";
const run = await runBenchmark();
const rec = run.receipts.get("canada");
writeFileSync("/tmp/writ-demo-receipt.json", JSON.stringify(rec, null, 2));
const t = JSON.parse(JSON.stringify(rec)); t.result = "-1";
writeFileSync("/tmp/writ-demo-receipt-tampered.json", JSON.stringify(t, null, 2));
console.log("  canada receipt:", rec.result, "/", rec.result_status);
'
echo "  verify authentic:"; CLI receipt verify /tmp/writ-demo-receipt.json 2>&1 | sed 's/^/    /'
echo "  verify tampered (result field flipped +1 -> -1):"; (CLI receipt verify /tmp/writ-demo-receipt-tampered.json 2>&1 || true) | sed 's/^/    /'

rule "done"
echo "  Compatibility check complete. These historical scores are not Writ's"
echo "  general product model or primary demonstration."
