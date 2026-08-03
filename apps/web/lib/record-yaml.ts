/**
 * A record, rendered as the stored YAML it already is.
 *
 * This is a projection, not a translation: the keys are the reviewers' own field
 * names, the values are their own values, and the order is the order the guided
 * view uses, so the two renderings can never disagree about what the record says.
 * It is deliberately not a `.writ` program — a Writ query and a corpus record are
 * different artifacts, and the caller labels this one accordingly.
 *
 * Long values are folded rather than truncated, which is why a field maps to a
 * list of lines rather than one.
 */

import type { LabRecordCodeLine, RecordFieldKey } from "./record-view.js";

export interface YamlEntry {
  key: string;
  value: string | readonly string[];
  /** The record field this entry came from, where it is one. */
  field?: RecordFieldKey;
}

/** A bare comment line between entries. */
export interface YamlComment {
  comment: string;
}

export type YamlLine = YamlEntry | YamlComment;

function isComment(line: YamlLine): line is YamlComment {
  return "comment" in line;
}

export interface RenderedYaml {
  text: string;
  lines: readonly LabRecordCodeLine[];
  /** 1-based code lines, keyed by field, for the guided view to highlight. */
  linesByField: ReadonlyMap<RecordFieldKey, readonly number[]>;
}

/** Where a folded scalar wraps. Chosen so a quoted provision stays readable. */
const WRAP = 72;

function foldWords(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= WRAP) line = `${line} ${word}`;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

function entryLines(entry: YamlEntry): string[] {
  if (Array.isArray(entry.value)) {
    return [`${entry.key}: [${(entry.value as readonly string[]).join(", ")}]`];
  }
  const value = String(entry.value).replace(/\s+/g, " ").trim();
  if (value.length + entry.key.length + 2 <= WRAP && !/[:#]/.test(value)) {
    return [`${entry.key}: ${value}`];
  }
  // A folded block scalar keeps the reviewers' wording intact across the wrap.
  return [`${entry.key}: >-`, ...foldWords(value).map((line) => `  ${line}`)];
}

export function renderRecordYaml(
  header: readonly string[],
  entries: readonly YamlLine[],
): RenderedYaml {
  const lines: LabRecordCodeLine[] = [];
  const linesByField = new Map<RecordFieldKey, number[]>();

  for (const comment of header) {
    lines.push({ n: lines.length + 1, text: `# ${comment}`, field: null });
  }

  for (const entry of entries) {
    if (isComment(entry)) {
      lines.push({ n: lines.length + 1, text: "", field: null });
      lines.push({ n: lines.length + 1, text: `# ${entry.comment}`, field: null });
      continue;
    }
    for (const text of entryLines(entry)) {
      const n = lines.length + 1;
      lines.push({ n, text, field: entry.field ?? null });
      if (entry.field) {
        const existing = linesByField.get(entry.field);
        if (existing) existing.push(n);
        else linesByField.set(entry.field, [n]);
      }
    }
  }

  return {
    text: lines.map((line) => line.text).join("\n"),
    lines,
    linesByField,
  };
}
