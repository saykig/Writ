"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { EvaluationReceipt } from "@writ/domain";

import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AnalysisPanel } from "./analysis-panel";
import { EvidencePanel } from "./evidence-panel";
import { IrPanel } from "./ir-panel";
import { ReceiptPanel } from "./receipt-panel";
import { VerdictInline } from "./verdict";
import type {
  AnalyzeResponse,
  CompileResponse,
  ExampleEffect,
  EvidenceView,
  ExamplesResponse,
  Member,
  LabExample,
} from "./types";

const WritEditor = dynamic(() => import("./writ-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-paper-deep/30">
      <span className="text-[0.72rem] uppercase tracking-[0.14em] text-ink-faint">
        Loading editor…
      </span>
    </div>
  ),
});

const OUTCOME_DOT: Record<ExampleEffect, string> = {
  reviewed: "bg-true",
  flips: "bg-false",
  widens: "bg-gold",
  gap: "bg-gold",
};

/** What each reading does to the answer, so the lesson reads before a click. */
const OUTCOME_LABEL: Record<ExampleEffect, string> = {
  reviewed: "as reviewed",
  flips: "US turns to yes",
  widens: "EU evidence widens",
  gap: "leaves a gap",
};

const OUTCOME_TAG_TONE: Record<ExampleEffect, string> = {
  reviewed: "text-true",
  flips: "text-false",
  widens: "text-gold",
  gap: "text-gold",
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

export interface WritLabProps {
  /** Example to open first, from `?example=` — validated server-side. */
  initialExample: string | null;
  /** Optional frozen examples for a contextual Lab route. */
  initialExamples?: readonly LabExample[];
  /** Optional member and receipt to open without a second selection step. */
  initialMember?: Member;
  initialReceipt?: EvaluationReceipt;
  initialEvidence?: EvidenceView;
  lockInitialMember?: boolean;
  initialResultTab?: "analysis" | "ir" | "receipt";
  initialCompile?: CompileResponse;
  initialAnalysis?: AnalyzeResponse;
}

export function WritLab({
  initialExample,
  initialExamples,
  initialMember,
  initialReceipt,
  initialEvidence,
  lockInitialMember = false,
  initialResultTab = "analysis",
  initialCompile,
  initialAnalysis,
}: WritLabProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const seededExample =
    initialExamples?.find((example) => example.id === initialExample) ?? initialExamples?.[0];
  const [examples, setExamples] = useState<LabExample[]>(
    initialExamples ? [...initialExamples] : [],
  );
  const [exampleId, setExampleId] = useState<string | null>(seededExample?.id ?? null);
  const [source, setSource] = useState<string>(seededExample?.source ?? "");

  const [compile, setCompile] = useState<CompileResponse | null>(initialCompile ?? null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(initialAnalysis ?? null);
  const [analyzing, setAnalyzing] = useState(false);

  const [isDesktop, setIsDesktop] = useState(true);
  const reqId = useRef(0);
  const readingRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Track the breakpoint so the split flips from side-by-side to stacked.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Load the seeded readings; open the requested one (or the first).
  useEffect(() => {
    if (initialExamples) return;
    let active = true;
    fetch("/api/examples")
      .then((r) => r.json() as Promise<ExamplesResponse>)
      .then((data) => {
        if (!active) return;
        setExamples(data.examples);
        const initial =
          data.examples.find((example) => example.id === initialExample) ?? data.examples[0];
        if (initial) {
          setExampleId(initial.id);
          setSource(initial.source);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [initialExample, initialExamples]);

  // Debounced compile + analyze on every source change.
  useEffect(() => {
    if (!source) return;
    const id = (reqId.current += 1);
    const timer = window.setTimeout(async () => {
      setAnalyzing(true);
      try {
        const [compileRes, analyzeRes] = await Promise.all([
          postJson<CompileResponse>("/api/compile", { source }),
          postJson<AnalyzeResponse>("/api/analyze", { source }),
        ]);
        if (id !== reqId.current) return;
        setCompile(compileRes);
        setAnalysis(analyzeRes);
      } catch {
        /* leave the previous result in place on a transient failure */
      } finally {
        if (id === reqId.current) setAnalyzing(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [source]);

  const selectExample = useCallback((example: LabExample) => {
    setExampleId(example.id);
    setSource(example.source);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("example", example.id);
      window.history.replaceState(null, "", url);
    }
  }, []);

  // Arrow-key navigation for the reading radiogroup (roving tabindex).
  const onReadingKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const count = examples.length;
      if (!count) return;
      let next = index;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
        next = (index - 1 + count) % count;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = count - 1;
      else return;
      event.preventDefault();
      selectExample(examples[next]);
      readingRefs.current[next]?.focus();
    },
    [examples, selectExample],
  );

  const diagnostics = compile?.diagnostics ?? [];
  const errors = diagnostics.filter((d) => d.severity === "error");
  const findings = analysis?.findings ?? [];
  const gap = findings.find((f) => f.code === "WRT-SCORE-GAP") ?? null;
  const compiled = Boolean(compile?.ir);
  const canEvaluate = compiled && errors.length === 0;
  const activeExample = examples.find((example) => example.id === exampleId);
  const edited = activeExample ? source !== activeExample.source : false;

  // Compile status line — a quiet pip plus one word, no gold (the verdict owns it).
  let statusText: string;
  let statusTone: string;
  let statusPip: string;
  if (analyzing) {
    statusText = "compiling";
    statusTone = "text-ink-faint";
    statusPip = "animate-pulse bg-ink-faint/50";
  } else if (!compile) {
    statusText = "idle";
    statusTone = "text-ink-faint";
    statusPip = "bg-ink-faint/40";
  } else if (errors.length) {
    statusText = `${errors.length} error${errors.length > 1 ? "s" : ""}`;
    statusTone = "text-false";
    statusPip = "bg-false";
  } else if (findings.length) {
    statusText = `${findings.length} finding${findings.length > 1 ? "s" : ""}`;
    statusTone = "text-ink-soft";
    statusPip = "bg-ink-faint/60";
  } else {
    statusText = "clean";
    statusTone = "text-true";
    statusPip = "bg-true";
  }

  const editorPane = (
    <div className="flex h-full min-h-0 flex-col bg-paper-deep/40">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
        <span className="font-mono text-[0.72rem] text-ink-faint">query-methodology.writ</span>
        <span className="flex items-center gap-2 text-[0.72rem]">
          <span aria-hidden className={cn("size-1.5 rounded-full", statusPip)} />
          <span className={statusTone}>{statusText}</span>
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <WritEditor
          value={source}
          onChange={setSource}
          isDark={isDark}
          diagnostics={diagnostics}
          gap={gap}
        />
      </div>
    </div>
  );

  const resultsPane = (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs defaultValue={initialResultTab} className="flex h-full min-h-0 flex-col gap-0">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-5 border-b border-rule px-5 py-0"
        >
          <TabsTrigger value="analysis" className="flex-none px-0 py-3">
            Analysis
            {findings.length ? (
              <span className="ml-1.5 text-[0.7rem] text-ink-faint tabular-nums">
                {findings.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="ir" className="flex-none px-0 py-3">
            Query IR
          </TabsTrigger>
          <TabsTrigger value="receipt" className="flex-none px-0 py-3">
            Trace
          </TabsTrigger>
          {initialEvidence ? (
            <TabsTrigger value="evidence" className="flex-none px-0 py-3">
              Records
              <span className="ml-1.5 text-[0.7rem] text-ink-faint tabular-nums">
                {initialEvidence.actions.length}
              </span>
            </TabsTrigger>
          ) : null}
        </TabsList>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
          <TabsContent value="analysis">
            <AnalysisPanel errors={errors} findings={findings} compiled={compiled} />
          </TabsContent>
          <TabsContent value="ir">
            <IrPanel
              ir={compile?.ir ?? null}
              schemaValid={Boolean(compile?.schemaValid)}
              hasErrors={errors.length > 0}
            />
          </TabsContent>
          <TabsContent value="receipt">
            <ReceiptPanel
              source={source}
              canEvaluate={canEvaluate}
              initialMember={initialMember}
              initialReceipt={initialReceipt}
              lockMember={lockInitialMember}
            />
          </TabsContent>
          {initialEvidence ? (
            <TabsContent value="evidence">
              <EvidencePanel evidence={initialEvidence} />
            </TabsContent>
          ) : null}
        </div>
      </Tabs>
    </div>
  );

  return (
    <div className="flex-1">
      <div className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-[112rem] flex-col gap-3 px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[0.72rem] text-muted-foreground">
          <span>Saved query · EU AI governance v1.0.0 + US AI governance v1.0.0</span>
          <span className="font-mono">queries/eu-us-ai-governance-pilot</span>
        </div>
        {/* The readings, as cards. Each says what it changes and what that does
            to the answer, so the choice is legible before it is made. */}
        <div
          role="radiogroup"
          aria-label="Reading of the model-evaluation test"
          className="grid grid-cols-2 gap-2 lg:grid-cols-4"
        >
          {examples.map((example, index) => {
            const active = example.id === exampleId;
            return (
              <button
                key={example.id}
                ref={(el) => {
                  readingRefs.current[index] = el;
                }}
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onClick={() => selectExample(example)}
                onKeyDown={(event) => onReadingKeyDown(event, index)}
                title={example.note}
                className={cn(
                  "flex min-w-0 flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "border-foreground/25 bg-card shadow-sm"
                    : "border-border bg-muted/25 hover:border-border hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      OUTCOME_DOT[example.effect],
                      active ? "opacity-100" : "opacity-50",
                    )}
                  />
                  <span
                    className={cn(
                      "min-w-0 truncate text-[0.85rem]",
                      active ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {example.title}
                  </span>
                </span>
                <span
                  className={cn(
                    "truncate text-[0.7rem]",
                    OUTCOME_TAG_TONE[example.effect],
                    active ? "opacity-100" : "opacity-60",
                  )}
                >
                  {OUTCOME_LABEL[example.effect]}
                </span>
                <span className="truncate font-mono text-[0.66rem] text-muted-foreground/80">
                  {example.reading}
                </span>
              </button>
            );
          })}
        </div>

        {/* What the selected reading does, and whether it still holds together. */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-baseline gap-3">
            <p className="min-w-0 max-w-[68ch] text-[0.8rem] leading-6 text-muted-foreground">
              {activeExample?.note}
            </p>
            {edited ? (
              <button
                type="button"
                onClick={() => activeExample && selectExample(activeExample)}
                className="shrink-0 text-[0.78rem] text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
              >
                reset
              </button>
            ) : null}
          </div>

          <div className="min-w-0 max-w-full">
            <VerdictInline
              analyzing={analyzing}
              compiled={compiled}
              errors={errors}
              findings={findings}
              gap={gap}
            />
          </div>
        </div>

        {/* Workspace fills the viewport — the tool is the page. */}
        <div className="tool min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup orientation={isDesktop ? "horizontal" : "vertical"}>
            <ResizablePanel defaultSize={isDesktop ? 52 : 55} minSize={30}>
              {editorPane}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={isDesktop ? 48 : 45} minSize={25}>
              {resultsPane}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
