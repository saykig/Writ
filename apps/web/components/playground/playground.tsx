"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { Reveal } from "@/components/site/reveal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AnalysisPanel } from "./analysis-panel";
import { IrPanel } from "./ir-panel";
import { ReceiptPanel } from "./receipt-panel";
import { Verdict } from "./verdict";
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
    <div className="flex h-full w-full items-center justify-center bg-paper-deep/30">
      <span className="text-[0.72rem] uppercase tracking-[0.14em] text-ink-faint">
        Loading editor…
      </span>
    </div>
  ),
});

const OUTCOME_DOT: Record<ExampleOutcome, string> = {
  gap: "bg-gold",
  overlap: "bg-false",
  clean: "bg-true",
};

/** Plain one-word outcome shown on each reading, so the lesson reads before a click. */
const OUTCOME_LABEL: Record<ExampleOutcome, string> = {
  gap: "leaves a gap",
  overlap: "overlaps",
  clean: "clean",
};

const OUTCOME_TAG_TONE: Record<ExampleOutcome, string> = {
  gap: "text-gold",
  overlap: "text-false",
  clean: "text-true",
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
  const gap = findings.find((f) => f.code === "COV-SCORE-GAP") ?? null;
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
        <span className="font-mono text-[0.72rem] text-ink-faint">methodology.covenant</span>
        <span className="flex items-center gap-2 text-[0.72rem]">
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
    <div className="flex h-full min-h-0 flex-col">
      <Tabs defaultValue="analysis" className="flex h-full min-h-0 flex-col gap-0">
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
            IR
          </TabsTrigger>
          <TabsTrigger value="receipt" className="flex-none px-0 py-3">
            Receipt
          </TabsTrigger>
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
            <ReceiptPanel source={source} canEvaluate={canEvaluate} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20 lg:py-24">
        {/* Header */}
        <Reveal className="max-w-2xl">
          <SectionLabel>Playground · the live compiler</SectionLabel>
          <SectionHeading className="mt-4">Try it: one phrase, three readings.</SectionHeading>
          <Prose className="mt-5">
            The 2025 G7 rubric asks each member for &ldquo;up to four strong actions.&rdquo; That
            phrase can be read three ways, and each compiles to a different scoring program. Pick a
            reading below — Covenant compiles it, checks it for ambiguity before any evidence, and
            the verdict tells you what it found. Everything runs live, through the same engine as
            the benchmark.
          </Prose>
        </Reveal>

        {/* Reading switch */}
        <Reveal className="mt-10" delay={80}>
          <div
            role="radiogroup"
            aria-label="Reading of the 2025 AI-for-SMEs rubric"
            className="inline-flex flex-wrap gap-1 rounded-xl border border-rule bg-paper-deep/50 p-1"
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
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[0.92rem] transition-colors focus-visible:outline-none",
                    active
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full transition-opacity",
                      OUTCOME_DOT[example.outcome],
                      active ? "opacity-100" : "opacity-60",
                    )}
                  />
                  <span>{example.title.replace(/\s+reading$/i, "")}</span>
                  <span
                    className={cn(
                      "text-[0.72rem] transition-opacity",
                      OUTCOME_TAG_TONE[example.outcome],
                      active ? "opacity-100" : "opacity-55",
                    )}
                  >
                    {OUTCOME_LABEL[example.outcome]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Verdict */}
          <div className="mt-6 max-w-2xl">
            <Verdict
              analyzing={analyzing}
              compiled={compiled}
              errors={errors}
              findings={findings}
              gap={gap}
              note={edited ? null : (activeExample?.note ?? null)}
            />
          </div>
        </Reveal>

        {/* Workspace — the card renders outside any transform so Monaco can
            measure its own height reliably on mount. */}
        <div className="mt-16">
          <Reveal className="max-w-2xl" delay={40}>
            <SectionLabel>Under the hood</SectionLabel>
            <p className="mt-3 max-w-[60ch] text-[0.95rem] leading-[1.65] text-ink-soft [text-wrap:pretty]">
              <strong className="text-foreground">Left:</strong> the methodology, as a program —
              edit it and the verdict above recomputes live.{" "}
              <strong className="text-foreground">Right:</strong> what the analyzer found, the
              compiled form it reasons over, and a real member country&rsquo;s receipt — the full
              score, its proof, and the hash you can verify.
            </p>
          </Reveal>

          <div className="tool mt-6 h-[62vh] min-h-[520px] overflow-hidden lg:h-[660px]">
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
    </main>
  );
}
