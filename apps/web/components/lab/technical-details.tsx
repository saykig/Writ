"use client";

/**
 * The workbench, kept but no longer in the way.
 *
 * Everything that used to open the Lab — the four readings of the score program,
 * the editor, the analysis, the query IR, the processing trace and the retrieved
 * records — is here, unchanged. It is real work and none of it was deleted; it
 * is simply not the first thing a reader meets, because understanding how a
 * passage becomes a record does not require reading a score program first.
 *
 * Children mount on first open. A closed `<details>` keeps its contents in the
 * DOM at zero size, and both the editor and the resizable panels measure
 * themselves on mount — mounted while hidden, they paint nothing when opened.
 * Deferring also keeps the compile cycle off every Lab page view.
 */

import * as React from "react";
import type { EvaluationReceipt } from "@writ/domain";

import { Disclosure } from "./disclosure";
import { WritLab } from "./writ-lab";
import type { EvidenceView, LabExample, Member } from "./types";

export function TechnicalDetails({
  initialExample,
  initialExamples,
  initialEvidence,
  initialMember,
  initialReceipt,
  defaultOpen = false,
}: {
  initialExample: string | null;
  initialExamples?: readonly LabExample[];
  initialEvidence?: EvidenceView;
  initialMember?: Member;
  initialReceipt?: EvaluationReceipt;
  defaultOpen?: boolean;
}) {
  const [everOpened, setEverOpened] = React.useState(defaultOpen);

  return (
    <Disclosure
      summary="Technical details"
      meta="query IR · processing trace · retrieved records"
      defaultOpen={defaultOpen}
      onToggle={(open) => {
        if (open) setEverOpened(true);
      }}
    >
      <p className="max-w-[70ch] pb-4 text-[0.8rem] leading-6 text-muted-foreground">
        The reviewed question as a Writ query, the readings it can be given, and what the engine did
        with each. This is the machinery behind the record above, not a second account of it.
      </p>
      {everOpened ? (
        <WritLab
          initialExample={initialExample}
          initialExamples={initialExamples}
          initialEvidence={initialEvidence}
          initialMember={initialMember}
          initialReceipt={initialReceipt}
        />
      ) : null}
    </Disclosure>
  );
}
