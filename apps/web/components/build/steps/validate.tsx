"use client";

/**
 * Step 5 — what holds together.
 *
 * The same seven checks the Lab runs over a reviewed record, run here over a
 * draft. Most of them will read "not recorded" on a fresh draft, and that is the
 * point: the form reports what has been established rather than grading how
 * complete it looks.
 *
 * The three actions are the whole set. There is deliberately no publish, no
 * submit, no pull request and no export.
 */

import * as React from "react";

import type { BuildDraft } from "@/lib/build-draft";
import { draftSourceState, draftToClaimFields, draftToYaml } from "@/lib/build-draft";
import { checksSummary, recordChecks } from "@/lib/record-checks";
import { RecordStatus } from "@/components/record/record-status";
import { CodeArtifact } from "@/components/site/code-artifact";
import { Button } from "@/components/ui/button";

export function Validate({
  draft,
  onBack,
  onSave,
  saveState,
}: {
  draft: BuildDraft;
  onBack: () => void;
  onSave: () => void;
  saveState: { savedAt: string | null; failed: boolean };
}) {
  const [showStructured, setShowStructured] = React.useState(false);

  const checks = React.useMemo(
    () =>
      recordChecks({
        fields: draftToClaimFields(draft),
        source: draftSourceState(draft),
        interpretation: { text: draft.record.uncertainty, inherited: false },
      }),
    [draft],
  );

  const yaml = React.useMemo(() => draftToYaml(draft), [draft]);

  return (
    <div className="space-y-7">
      <RecordStatus checks={checks} summary={checksSummary(checks)} heading="Draft status" />

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={onSave}>
          Save draft
        </Button>
        <Button size="sm" variant="outline" onClick={onBack}>
          Continue reviewing
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowStructured((open) => !open)}>
          {showStructured ? "Hide structured record" : "View structured record"}
        </Button>
      </div>

      {saveState.failed ? (
        <p className="text-[0.76rem] leading-6 text-muted-foreground">
          This browser refused to store the draft. It is still held for this session, but it will
          not survive a reload.
        </p>
      ) : saveState.savedAt ? (
        <p className="text-[0.76rem] leading-6 text-muted-foreground">
          Saved in this browser at {saveState.savedAt.slice(11, 16)}. Drafts stay here; nothing is
          published or sent anywhere.
        </p>
      ) : (
        <p className="text-[0.76rem] leading-6 text-muted-foreground">
          A saved draft is kept in this browser only.
        </p>
      )}

      {showStructured ? (
        <CodeArtifact
          code={yaml.text}
          label="Draft record"
          filename="draft.record.yaml"
          caption="An output of the form above, not a place to edit. This draft belongs to no corpus."
        />
      ) : null}
    </div>
  );
}
