"use client";

/**
 * Step 4 — the record itself.
 *
 * The fields adapt twice. A corpus that is not policy drops the legal-force
 * group entirely, because force, adoption, applicability and enforcement are
 * claims about instruments and mean nothing about an observation. And a record
 * type the reviewed corpus never pairs with a conduct — an exception, a scope
 * rule, a lifecycle rule — says so beside the conduct field, so that leaving it
 * empty reads as the right answer rather than an unfinished one.
 *
 * Every coded option comes from the reviewed corpus, and `unknown` is offered
 * everywhere, because a reviewer must always be able to say they could not tell.
 */

import type { BuildDraft } from "@/lib/build-draft";
import { needsLegalForce } from "@/lib/build-draft";
import type { BuildVocabulary } from "@/lib/build-vocabulary";
import { humanize } from "@/lib/demo-analysis-format";
import { SelectField, TextAreaField, TextField } from "../fields";

export function ReviewRecord({
  draft,
  vocabulary,
  onChange,
}: {
  draft: BuildDraft;
  vocabulary: BuildVocabulary;
  onChange: (patch: Partial<BuildDraft["record"]>) => void;
}) {
  const { record } = draft;
  const legal = needsLegalForce(draft);
  const conductOptional = vocabulary.recordTypesWithoutConduct.includes(record.recordType);

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <SelectField
          label="Record type"
          value={record.recordType}
          options={vocabulary.recordType}
          help="Every option is a type the reviewed corpus already uses."
          onChange={(value) => onChange({ recordType: value })}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Actor"
            value={record.actorType}
            options={vocabulary.actorType}
            onChange={(value) => onChange({ actorType: value })}
          />
          <TextField
            label="Actor, in the source’s own words"
            value={record.actorTerm}
            placeholder="provider of a general-purpose AI model"
            onChange={(value) => onChange({ actorTerm: value })}
          />
          <SelectField
            label="Claim or conduct"
            value={record.conductType}
            options={vocabulary.conductType}
            help={
              conductOptional
                ? `A record of type ${humanize(record.recordType).toLowerCase()} classifies no conduct of its own. Leaving this empty is correct.`
                : undefined
            }
            onChange={(value) => onChange({ conductType: value })}
          />
          <TextField
            label="Conduct, in the source’s own words"
            value={record.conductTerm}
            placeholder="perform model evaluation"
            onChange={(value) => onChange({ conductTerm: value })}
          />
          <TextField
            label="Object"
            help="What the record is about, where it names one."
            value={record.object}
            placeholder="general-purpose AI model"
            onChange={(value) => onChange({ object: value })}
          />
          <TextField
            label="Authority"
            help="Who is responsible for it, where the source says."
            value={record.authority}
            placeholder="European Commission"
            onChange={(value) => onChange({ authority: value })}
          />
        </div>
        <TextAreaField
          label="Conditions"
          rows={3}
          help="Any condition the source attaches — a threshold, an exception, a date."
          value={record.conditions}
          onChange={(value) => onChange({ conditions: value })}
        />
      </section>

      {legal ? (
        <section className="space-y-5 border-t border-border pt-6">
          <div>
            <h3 className="text-[0.62rem] tracking-[0.12em] uppercase text-muted-foreground">
              Legal standing
            </h3>
            <p className="mt-1 text-[0.76rem] leading-6 text-muted-foreground">
              Force, adoption, applicability and enforcement are four separate questions. A measure
              can be adopted without applying yet, and applicable without a recorded enforcement
              route.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label="Legal force"
              value={record.legalForce}
              options={vocabulary.legalForce}
              onChange={(value) => onChange({ legalForce: value })}
            />
            <SelectField
              label="Adoption"
              value={record.adoption}
              options={vocabulary.adoption}
              onChange={(value) => onChange({ adoption: value })}
            />
            <SelectField
              label="Applicability"
              value={record.applicability}
              options={vocabulary.applicability}
              onChange={(value) => onChange({ applicability: value })}
            />
            <SelectField
              label="Enforcement"
              value={record.enforcement}
              options={vocabulary.enforcement}
              help="Choose unknown where the source does not say. It is kept as a judgment, not filled in later."
              onChange={(value) => onChange({ enforcement: value })}
            />
          </div>
        </section>
      ) : (
        <section className="border-t border-border pt-6">
          <p className="text-[0.78rem] leading-6 text-muted-foreground">
            This corpus is {draft.corpus.family}, so the legal-force group does not apply. Force,
            adoption, applicability and enforcement describe instruments, not observations or
            propositions.
          </p>
        </section>
      )}

      <section className="space-y-5 border-t border-border pt-6">
        <TextAreaField
          label="Evidence"
          rows={3}
          help="What in the passage supports this reading."
          value={record.evidence}
          onChange={(value) => onChange({ evidence: value })}
        />
        <TextAreaField
          label="Uncertainty"
          rows={3}
          help="What the source does not settle. Recorded as it stands, never resolved for the reader."
          value={record.uncertainty}
          onChange={(value) => onChange({ uncertainty: value })}
        />
      </section>
    </div>
  );
}
