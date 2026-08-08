import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const nistRoot = join(root, "corpora/institutional/us/nist");
const commissionRoot = join(root, "corpora/institutional/eu/european-commission");

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(...args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd: root });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  return result.stdout.toString().trim();
}

function blocks(text: string, keyword: "record" | "judgment"): Array<{ id: string; raw: string }> {
  const found: Array<{ id: string; raw: string }> = [];
  const start = new RegExp(`(?:^|\\n)${keyword}\\s+([a-zA-Z0-9_.-]+)(?:\\s+:[^{]+)?\\s*\\{`, "g");
  let match: RegExpExecArray | null;
  while ((match = start.exec(text)) !== null) {
    const blockStart = match.index + (match[0].startsWith("\n") ? 1 : 0);
    const open = text.indexOf("{", blockStart);
    let depth = 0;
    let quoted = false;
    let escaped = false;
    let end = open;
    for (; end < text.length; end += 1) {
      const char = text[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') quoted = true;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    found.push({ id: match[1], raw: text.slice(blockStart, end) });
    start.lastIndex = end;
  }
  return found;
}

function quoted(raw: string, pattern: RegExp): string | null {
  const match = raw.match(pattern);
  return match ? JSON.parse(`"${match[1]}"`) : null;
}

function treeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? treeFiles(path) : [path];
  });
}

function exactFile(path: string) {
  const bytes = readFileSync(join(root, path));
  return {
    path,
    size_bytes: bytes.length,
    sha256: `sha256:${sha256(bytes)}`,
    bytes_base64: bytes.toString("base64"),
  };
}

const recordsText = read("corpora/institutional/us/nist/records.writ");
const judgmentsText = read("corpora/institutional/us/nist/judgments.writ");
const migrationText = read("corpora/institutional/us/nist/migration.yaml");
const manifestText = read("corpora/institutional/us/nist/corpus.yaml");
const migration = Bun.YAML.parse(migrationText) as Record<string, unknown>;
const manifest = Bun.YAML.parse(manifestText) as Record<string, unknown>;

const recordInventory = blocks(recordsText, "record").map(({ id, raw }) => {
  const assertion = raw.match(/assertion\s+([a-z_]+)\s+"((?:[^"\\]|\\.)*)";/);
  const provenance = raw.match(/provenance\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  return {
    record_id: id,
    assertion: assertion
      ? { mode: assertion[1], text: JSON.parse(`"${assertion[2]}"`) }
      : null,
    review_state: raw.match(/review_state\s+([a-z_]+);/)?.[1] ?? null,
    provenance: {
      created_by: quoted(provenance, /created_by\s+"((?:[^"\\]|\\.)*)";/),
      created_at: provenance.match(/created_at\s+([^;]+);/)?.[1] ?? null,
    },
  };
});

const passageMap = new Map<string, Record<string, string>>();
for (const { raw } of blocks(recordsText, "record")) {
  const evidence = /support\s+([a-zA-Z0-9_.-]+)\s+document_version\s+([a-zA-Z0-9_.-]+)\s+passage\s+([a-zA-Z0-9_.-]+)\s+locator\s+"((?:[^"\\]|\\.)*)"\s+quote\s+"((?:[^"\\]|\\.)*)"\s+passage_hash\s+"([^\"]+)"\s+document_hash\s+"([^\"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = evidence.exec(raw)) !== null) {
    passageMap.set(match[3], {
      source_id: match[1],
      document_version_id: match[2],
      passage_id: match[3],
      locator: JSON.parse(`"${match[4]}"`),
      quotation: JSON.parse(`"${match[5]}"`),
      passage_hash: match[6],
      document_hash: match[7],
    });
  }
}

const relationshipPaths = treeFiles(join(nistRoot, "relationships"))
  .map((path) => relative(root, path))
  .sort();
const commissionTree = treeFiles(commissionRoot)
  .map((path) => {
    const bytes = readFileSync(path);
    return {
      path: relative(root, path),
      size_bytes: statSync(path).size,
      sha256: `sha256:${sha256(bytes)}`,
    };
  })
  .sort((left, right) => left.path.localeCompare(right.path));

const inventory = {
  inventory_version: "1.0.0",
  generated_for: "institutional-stage-b",
  starting_main_sha: git("rev-parse", "HEAD"),
  branch: git("branch", "--show-current"),
  nist_stage_a: {
    records: recordInventory,
    record_ids: recordInventory.map((record) => record.record_id),
    links: relationshipPaths.map((path) => {
      const parsed = Bun.YAML.parse(read(path)) as Record<string, unknown>;
      return { link_id: parsed.link_id, ...exactFile(path) };
    }),
    link_ids: relationshipPaths.map(
      (path) => (Bun.YAML.parse(read(path)) as Record<string, string>).link_id,
    ),
    judgments: blocks(judgmentsText, "judgment").map(({ id, raw }) => ({
      judgment_id: id,
      target_kind: raw.match(/target\s+(record|record_link)\s+/)?.[1] ?? null,
      target_id: raw.match(/target\s+(?:record|record_link)\s+([a-zA-Z0-9_.-]+);/)?.[1] ?? null,
      status: raw.match(/\n\s*status\s+([a-z_]+);/)?.[1] ?? null,
    })),
    judgment_ids: blocks(judgmentsText, "judgment").map(({ id }) => id),
    judgments_file: exactFile("corpora/institutional/us/nist/judgments.writ"),
    sources_file: exactFile("corpora/institutional/us/nist/sources.writ"),
    sources: (migration.preserved_evidence as { sources: unknown[] }).sources,
    passages: [...passageMap.values()].sort((left, right) =>
      left.passage_id.localeCompare(right.passage_id),
    ),
    manifest: {
      corpus_version: manifest.corpus_version,
      status: manifest.status,
      record_contract: manifest.record_contract,
      record_counts: manifest.record_counts,
      review_counts: manifest.review_counts,
      unresolved_evidence_count: manifest.unresolved_evidence_count,
    },
    migration: {
      sha256: `sha256:${sha256(migrationText)}`,
      stage: migration.stage,
      base_sha: migration.base_sha,
      entries: migration.entries,
    },
  },
  european_commission_baseline: {
    tree: commissionTree,
    manifest: Bun.YAML.parse(read("corpora/institutional/eu/european-commission/corpus.yaml")),
    records: blocks(read("corpora/institutional/eu/european-commission/records.writ"), "record").map(
      ({ id, raw }) => ({
        record_id: id,
        assertion: raw.match(/assertion\s+([a-z_]+)\s+"((?:[^"\\]|\\.)*)";/)
          ? {
              mode: raw.match(/assertion\s+([a-z_]+)\s+/)![1],
              text: quoted(raw, /assertion\s+[a-z_]+\s+"((?:[^"\\]|\\.)*)";/),
            }
          : null,
        review_state: raw.match(/review_state\s+([a-z_]+);/)?.[1] ?? null,
        provenance: {
          created_by: quoted(raw, /provenance\s*\{[\s\S]*?created_by\s+"((?:[^"\\]|\\.)*)";/),
          created_at: raw.match(/provenance\s*\{[\s\S]*?created_at\s+([^;]+);/)?.[1] ?? null,
        },
        evidence: raw.match(/evidence\s*\{([\s\S]*?)\}/)?.[1]?.trim() ?? null,
        subjects: raw.match(/subjects\s*\{([\s\S]*?)\}/)?.[1]?.trim() ?? null,
        scope: raw.match(/scope\s*\{([\s\S]*?)\n\s*\}/)?.[1]?.trim() ?? null,
      }),
    ),
  },
} as const;

const output = process.argv[2];
if (!output) throw new Error("usage: institutional_stage_b_inventory.ts <output-path>");
await Bun.write(join(root, output), `${JSON.stringify(inventory, null, 2)}\n`);
