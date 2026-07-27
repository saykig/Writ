"use client";

import * as React from "react";

import { PolicyEvidenceDetail } from "@/components/policy-test/policy-evidence-detail";
import { PolicyTestEvidence } from "@/components/policy-test/policy-test-evidence";
import { PolicyTestMethodology } from "@/components/policy-test/policy-test-methodology";
import { PolicyTestReceipt } from "@/components/policy-test/policy-test-receipt";
import { PolicyTestRule } from "@/components/policy-test/policy-test-rule";
import { PolicyTestStepper } from "@/components/policy-test/policy-test-stepper";
import {
  STAGES,
  type EvidenceEntry,
  type PolicyTestView,
  type StageId,
} from "@/components/policy-test/types";

const PANEL_ID = "policy-test-stage-panel";

/**
 * The four-stage policy test.
 *
 * The selected stage lives in the `stage` query parameter so a view can be
 * shared and refreshed. Following the pattern already used by the Writ Lab, the
 * server validates the incoming value and the client writes updates back with
 * `history.replaceState`, so moving between stages never reloads the page.
 */
export function PolicyTestWorkspace({
  view,
  initialStage,
}: {
  view: PolicyTestView;
  initialStage: StageId;
}) {
  const [stage, setStage] = React.useState<StageId>(initialStage);
  const [entry, setEntry] = React.useState<EvidenceEntry | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  const selectStage = React.useCallback((next: StageId) => {
    setStage(next);
    const url = new URL(window.location.href);
    url.searchParams.set("stage", next);
    window.history.replaceState(null, "", url);
  }, []);

  const openEntry = React.useCallback((next: EvidenceEntry, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setEntry(next);
  }, []);

  // Focus returns to the row that opened the panel, so keyboard users are not
  // dropped back at the top of the document.
  const closeEntry = React.useCallback(() => {
    setEntry(null);
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

  const entriesById = React.useMemo(() => {
    const index = new Map<string, EvidenceEntry>();
    for (const group of view.groups) {
      index.set(group.parent.id, group.parent);
      for (const child of group.children) index.set(child.id, child);
    }
    return index;
  }, [view.groups]);

  const current = STAGES.find((item) => item.id === stage) ?? STAGES[0];

  return (
    <div className="grid grid-cols-1 gap-8 min-[900px]:grid-cols-[13rem_minmax(0,1fr)] min-[900px]:gap-12">
      <div className="min-w-0 min-[900px]:sticky min-[900px]:top-24 min-[900px]:self-start">
        <PolicyTestStepper stage={stage} onSelect={selectStage} panelId={PANEL_ID} />
      </div>

      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={`policy-test-stage-${current.id}`}
        tabIndex={-1}
        className="min-w-0 outline-none"
      >
        {/* Names the stage that is now showing, for screen readers. */}
        <p aria-live="polite" className="sr-only">
          Stage {STAGES.findIndex((item) => item.id === current.id) + 1} of {STAGES.length}:{" "}
          {current.label}
        </p>

        <h3 className="max-w-[26ch] text-[length:var(--t-h3)] leading-[1.2] font-semibold tracking-[-0.015em] text-balance">
          {current.heading}
        </h3>

        <div className="mt-6">
          {stage === "methodology" ? (
            <PolicyTestMethodology
              methodology={view.methodology}
              onAdvance={() => selectStage("rule")}
            />
          ) : null}

          {stage === "rule" ? (
            <PolicyTestRule
              conditions={view.ruleConditions}
              onAdvance={() => selectStage("evidence")}
            />
          ) : null}

          {stage === "evidence" ? (
            <PolicyTestEvidence
              view={view}
              onOpenEntry={openEntry}
              onAdvance={() => selectStage("receipt")}
            />
          ) : null}

          {stage === "receipt" ? (
            <PolicyTestReceipt
              view={view}
              entriesById={entriesById}
              onOpenEntry={openEntry}
              onInspectEvidence={() => selectStage("evidence")}
            />
          ) : null}
        </div>
      </div>

      <PolicyEvidenceDetail entry={entry} onClose={closeEntry} />
    </div>
  );
}
