// Read-only repository adapter. Never imported by the extraction core.
import { loadRepository } from "../../writ/src/repository.js";
import { resolveRoutedSource } from "../../writ/src/core/sources.js";

const corpus = "us.institutions.nist";
const captures = {
  "ecfr.title15_cfr_part_285": "ecfr-15-cfr-part-285.xml",
  "nist.handbook_150": "nist-handbook-150-2020-update-1.pdf",
};
const { snapshot } = loadRepository(process.cwd());
if (snapshot.loadIssues.length) throw new Error(JSON.stringify(snapshot.loadIssues));
const evidence = snapshot.records
  .filter(({ corpus_id, value }) => corpus_id === corpus && value.review_state === "approved")
  .flatMap(({ value }) => value.evidence)
  .filter(({ source_id }) => Object.hasOwn(captures, source_id))
  .sort((a, b) => (a.passage_id < b.passage_id ? -1 : a.passage_id > b.passage_id ? 1 : 0));
const sources = Object.entries(captures).map(([id, capture]) => {
  const source = resolveRoutedSource(snapshot, corpus, id);
  if (source.status !== "resolved") throw new Error(`Source does not resolve: ${id}`);
  return { ...source.source.value, capture };
});
process.stdout.write(JSON.stringify({ sources, evidence }));
