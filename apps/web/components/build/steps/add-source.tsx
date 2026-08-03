"use client";

/**
 * Step 2 — where the passage comes from.
 *
 * The passage is pasted rather than uploaded or fetched. A record whose source
 * is a summary is a different object from one whose source is the document's own
 * words, and the only way this form can tell the difference is to ask for the
 * words.
 */

import type { BuildDraft } from "@/lib/build-draft";
import { TextAreaField, TextField } from "../fields";

export function AddSource({
  draft,
  onChange,
}: {
  draft: BuildDraft;
  onChange: (patch: Partial<BuildDraft["source"]>) => void;
}) {
  const { source } = draft;
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Source title"
          value={source.title}
          placeholder="Regulation (EU) 2024/1689"
          onChange={(value) => onChange({ title: value })}
        />
        <TextField
          label="Issuing institution"
          value={source.institution}
          placeholder="Publications Office of the European Union"
          onChange={(value) => onChange({ institution: value })}
        />
        <TextField
          label="Date"
          type="date"
          value={source.date}
          onChange={(value) => onChange({ date: value })}
        />
        <TextField
          label="URL"
          type="url"
          value={source.url}
          placeholder="https://"
          onChange={(value) => onChange({ url: value })}
        />
      </div>
      <TextAreaField
        label="Source passage"
        rows={8}
        help="Paste the document's own words. Do not paraphrase: the passage is what the record will be checked against."
        value={source.passage}
        onChange={(value) => onChange({ passage: value })}
      />
    </div>
  );
}
