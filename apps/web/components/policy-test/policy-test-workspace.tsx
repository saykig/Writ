"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PolicyTestEvidence } from "@/components/policy-test/policy-test-evidence";
import { PolicyTestMethodology } from "@/components/policy-test/policy-test-methodology";
import { PolicyTestReceipt } from "@/components/policy-test/policy-test-receipt";
import { PolicyTestRule } from "@/components/policy-test/policy-test-rule";
import { STAGES, type PolicyTestView, type StageId } from "@/components/policy-test/types";

/**
 * The four stages of the policy test.
 *
 * The selected stage lives in the `stage` query parameter so a view can be
 * shared and refreshed: the server validates the incoming value and the client
 * writes updates back with `history.replaceState`, so moving between stages
 * never reloads the page. Everything opens in place; nothing opens in a dialog.
 */
export function PolicyTestWorkspace({
  view,
  initialStage,
}: {
  view: PolicyTestView;
  initialStage: StageId;
}) {
  const [stage, setStage] = React.useState<StageId>(initialStage);

  const selectStage = React.useCallback((next: string) => {
    setStage(next as StageId);
    const url = new URL(window.location.href);
    url.searchParams.set("stage", next);
    window.history.replaceState(null, "", url);
  }, []);

  const current = STAGES.find((item) => item.id === stage) ?? STAGES[0];

  return (
    <Tabs value={stage} onValueChange={selectStage}>
      {/* Wraps rather than scrolls, so a narrow screen never gets a hidden tab. */}
      <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-x-1 gap-y-0.5">
        {STAGES.map((item, index) => (
          <TabsTrigger key={item.id} value={item.id} className="gap-2">
            <span aria-hidden className="text-[0.7rem] tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <h3 className="mt-8 max-w-[30ch] text-[length:var(--t-h3)] leading-[1.2] font-semibold tracking-[-0.015em] text-balance">
        {current.heading}
      </h3>

      <TabsContent value="methodology" className="mt-6">
        <PolicyTestMethodology
          methodology={view.methodology}
          onAdvance={() => selectStage("rule")}
        />
      </TabsContent>

      <TabsContent value="rule" className="mt-6">
        <PolicyTestRule view={view} onAdvance={() => selectStage("evidence")} />
      </TabsContent>

      <TabsContent value="evidence" className="mt-6">
        <PolicyTestEvidence view={view} onAdvance={() => selectStage("receipt")} />
      </TabsContent>

      <TabsContent value="receipt" className="mt-6">
        <PolicyTestReceipt view={view} onInspectEvidence={() => selectStage("evidence")} />
      </TabsContent>
    </Tabs>
  );
}
