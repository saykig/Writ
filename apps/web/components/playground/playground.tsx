"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AnalysisPanel } from "./analysis-panel";
import { IrPanel } from "./ir-panel";
import { ReceiptPanel } from "./receipt-panel";
import type {
  AnalyzeResponse,
  CompileResponse,
  ExampleOutcome,
  ExamplesResponse,
  PlaygroundExample,
} from "./types";

const CovenantEditor = dynamic(() => import("./covenant-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-surface-2/20">
      <span className="label-mono animate-pulse">Loading editor…</span>
    </div>
  ),
});

const OUTCOME_DOT: Record<ExampleOutcome, string> = {
  gap: "bg-gold",
  overlap: "bg-false",
  clean: "bg-true",
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

export interface PlaygroundProps {
  /** Example to open first, from `?example=` — validated server-side. */
  initialExample: string | null;
}

export function Playground({ initialExample }: PlaygroundProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [examples, setExamples] = useState<PlaygroundExample[]>([]);
  const [exampleId, setExampleId] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");

  const [compile, setCompile] = useState<CompileResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [isDesktop, setIsDesktop] = useState(true);
  const reqId = useRef(0);

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
  }, [initialExample]);

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

  const selectExample = useCallback((example: PlaygroundExample) => {
    setExampleId(example.id);
    setSource(example.source);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("example", example.id);
      window.history.replaceState(null, "", url);
    }
  }, []);

  const diagnostics = compile?.diagnostics ?? [];
  const errors = diagnostics.filter((d) => d.severity === "error");
  const findings = analysis?.findings ?? [];
  const gap = findings.find((f) => f.code === "COV-SCORE-GAP") ?? null;
  const compiled = Boolean(compile?.ir);
  const canEvaluate = compiled && errors.length === 0;
  const activeExample = examples.find((example) => example.id === exampleId);

  // Compile status line.
  let statusText: string;
  let statusTone: string;
  if (analyzing) {
    statusText = "compiling…";
    statusTone = "text-ink-faint";
  } else if (!compile) {
    statusText = "—";
    statusTone = "text-ink-faint";
  } else if (errors.length) {
    statusText = `${errors.length} compile error${errors.length > 1 ? "s" : ""}`;
    statusTone = "text-false";
  } else if (findings.length) {
    statusText = `compiled · ${findings.length} finding${findings.length > 1 ? "s" : ""}`;
    statusTone = "text-gold";
  } else {
    statusText = "compiled · total and non-overlapping";
    statusTone = "text-true";
  }

  const statusPip = analyzing
    ? "bg-ink-faint/50 animate-pulse"
    : errors.length
      ? "bg-false"
      : findings.length
        ? "bg-gold"
        : compile
          ? "bg-true"
          : "bg-ink-faint/40";

  const editorPane = (
    <div className="flex h-full min-h-0 flex-col bg-surface-2/20">
      <div className="flex items-center justify-between gap-3 border-b border-border/80 bg-surface-2/50 px-3.5 py-2">
        <span className="label-mono">methodology.covenant</span>
        <span className="flex items-center gap-2 font-mono text-[0.72rem]">
          <span aria-hidden className={cn("size-1.5 rounded-full", statusPip)} />
          <span className={statusTone}>{statusText}</span>
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <CovenantEditor
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
    <div className="flex h-full min-h-0 flex-col bg-background">
      <Tabs defaultValue="analysis" className="flex h-full min-h-0 flex-col gap-0">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-4 border-b border-border/80 px-3.5 py-0"
        >
          <TabsTrigger value="analysis" className="flex-none px-0 py-2.5">
            Analysis
            {findings.length ? (
              <span className="ml-1.5 font-mono text-[0.68rem] text-gold tabular-nums">
                {findings.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="ir" className="flex-none px-0 py-2.5">
            IR
          </TabsTrigger>
          <TabsTrigger value="receipt" className="flex-none px-0 py-2.5">
            Receipt
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-auto px-3.5 py-4">
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
            <ReceiptPanel source={source} canEvaluate={canEvaluate} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[92rem] px-4 py-12 sm:px-6 lg:py-16">
        {/* Header */}
        <div className="max-w-2xl">
          <SectionLabel seam>Playground · live</SectionLabel>
          <SectionHeading className="mt-4">
            Compile, analyze, evaluate — in the open.
          </SectionHeading>
          <Prose className="mt-4">
            Edit a methodology in the Covenant DSL. It compiles to a canonical IR, the analyzer
            proves the score total and non-overlapping before any evidence exists, and a member
            evaluates against a frozen snapshot into a receipt you can recompute.
          </Prose>
        </div>

        {/* Example switcher */}
        <div className="mt-8 flex flex-col gap-3">
          <div
            role="tablist"
            aria-label="Reading of the 2025 AI-for-SMEs rubric"
            className="inline-flex flex-wrap gap-2"
          >
            {examples.map((example) => {
              const active = example.id === exampleId;
              return (
                <button
                  key={example.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectExample(example)}
                  className={cn(
                    "group inline-flex items-center gap-2.5 rounded-[3px] border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/60",
                    active
                      ? "border-gold/50 bg-gold-wash"
                      : "border-border bg-surface-2/30 hover:border-gold/30 hover:bg-surface-2/50",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("size-2 shrink-0 rounded-full", OUTCOME_DOT[example.outcome])}
                  />
                  <span>
                    <span className="block text-sm leading-tight text-foreground">
                      {example.title}
                    </span>
                    <span className="block font-mono text-[0.68rem] leading-tight text-ink-faint">
                      {example.reading}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {activeExample ? (
            <p className="max-w-3xl border-l-2 border-gold/40 pl-3 text-[0.86rem] leading-relaxed text-ink-soft">
              {activeExample.note}
            </p>
          ) : null}
        </div>

        {/* Workspace */}
        <div className="mt-6 h-[82vh] min-h-[560px] overflow-hidden rounded-[4px] border border-border ring-1 ring-foreground/[0.03] lg:h-[calc(100vh-8rem)] lg:max-h-[880px]">
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
    </main>
  );
}
