"use client";

/**
 * Step 1 — what this corpus is about.
 *
 * The corpus family is the one answer that changes the rest of the form. A
 * policy record carries legal force, adoption, applicability and enforcement; an
 * empirical or theoretical one does not, and asking for them would teach that
 * every record is an obligation.
 */

import type { BuildDraft, CorpusFamily } from "@/lib/build-draft";
import { CORPUS_FAMILIES } from "@/lib/build-draft";
import type { BuildVocabulary } from "@/lib/build-vocabulary";
import { SelectField, TextAreaField, TextField } from "../fields";

const FAMILY_HELP: Record<CorpusFamily, string> = {
  policy: "Records carry legal force, adoption, applicability and enforcement.",
  empirical: "Records report observations. The legal-force fields do not apply.",
  theoretical: "Records state propositions. The legal-force fields do not apply.",
};

export function DefineCorpus({
  draft,
  vocabulary,
  onChange,
}: {
  draft: BuildDraft;
  vocabulary: BuildVocabulary;
  onChange: (patch: Partial<BuildDraft["corpus"]>) => void;
}) {
  const { corpus } = draft;
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Corpus name"
          value={corpus.name}
          placeholder="EU–US AI evaluation"
          onChange={(value) => onChange({ name: value })}
        />
        <TextField
          label="Subject"
          value={corpus.subject}
          placeholder="Model evaluation duties"
          onChange={(value) => onChange({ subject: value })}
        />
        <SelectField
          label="Jurisdiction"
          value={corpus.jurisdiction}
          options={vocabulary.jurisdiction}
          onChange={(value) => onChange({ jurisdiction: value })}
        />
        {/* A corpus always belongs to a family, so no clearing option is offered. */}
        <SelectField
          label="Corpus family"
          value={corpus.family}
          options={CORPUS_FAMILIES}
          allowEmpty={false}
          help={FAMILY_HELP[corpus.family]}
          onChange={(value) => onChange({ family: (value || "policy") as CorpusFamily })}
        />
        <TextField
          label="Period from"
          type="date"
          value={corpus.periodFrom}
          onChange={(value) => onChange({ periodFrom: value })}
        />
        <TextField
          label="Period to"
          type="date"
          value={corpus.periodTo}
          onChange={(value) => onChange({ periodTo: value })}
        />
      </div>
      <TextAreaField
        label="Description"
        help="What this corpus covers, and what it deliberately leaves out."
        value={corpus.description}
        onChange={(value) => onChange({ description: value })}
      />
    </div>
  );
}
