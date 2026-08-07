"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, X } from "lucide-react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  CORPUS_CATALOG,
  CORPUS_CATALOG_SOURCE,
  type CatalogCorpusSummary,
  type CatalogRawFile,
} from "@/lib/corpus-catalog-data";

const RawSourceEditor = dynamic(() => import("./raw-source-editor"), {
  ssr: false,
  loading: () => <span className="raw-workspace-loading">Loading canonical source…</span>,
});

type MotionStyle = CSSProperties & Record<string, string | number | undefined>;
type GlyphName = "EU" | "US" | "EC" | "NIST";

interface NodeGeometry {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  mobileLabelX?: number;
  direction: "above" | "below" | "left" | "right" | "diagonal";
  align?: "start" | "end";
}

interface FeaturedRecord {
  corpusId: string;
  shortTitle: string;
  geometry: NodeGeometry;
}

interface FeaturedGroup {
  family: "legal_policy" | "institutional";
  glyph: GlyphName;
  jurisdiction: "EU" | "US";
  records: readonly FeaturedRecord[];
}

const CATALOG_BY_ID = new Map(CORPUS_CATALOG.map((corpus) => [corpus.corpusId, corpus]));

const FEATURED_GROUPS: readonly FeaturedGroup[] = [
  {
    family: "legal_policy",
    glyph: "EU",
    jurisdiction: "EU",
    records: [
      {
        corpusId:
          "writ.corpus.legal-policy.eu.european-union.artificial-intelligence-act-2024-1689",
        shortTitle: "AI Act",
        geometry: {
          x: 27,
          y: 21,
          labelX: 12,
          labelY: 2,
          mobileLabelX: 35,
          direction: "diagonal",
          align: "end",
        },
      },
      {
        corpusId: "writ.corpus.legal-policy.eu.european-commission.gpai-guidelines",
        shortTitle: "GPAI Guidelines",
        geometry: {
          x: 76,
          y: 34,
          labelX: 106,
          labelY: 23,
          mobileLabelX: 75,
          direction: "right",
        },
      },
      {
        corpusId:
          "writ.corpus.legal-policy.eu.european-commission.gpai-code-of-practice-signatory-notice",
        shortTitle: "Code of Practice notice",
        geometry: {
          x: 63,
          y: 76,
          labelX: 91,
          labelY: 91,
          mobileLabelX: 70,
          direction: "diagonal",
        },
      },
    ],
  },
  {
    family: "legal_policy",
    glyph: "US",
    jurisdiction: "US",
    records: [
      {
        corpusId: "writ.corpus.legal-policy.us.nist.ai-risk-management-framework-1-0",
        shortTitle: "NIST RMF",
        geometry: {
          x: 31,
          y: 17,
          labelX: 4,
          labelY: -6,
          mobileLabelX: 35,
          direction: "above",
          align: "end",
        },
      },
      {
        corpusId: "writ.corpus.legal-policy.us.nist.generative-ai-profile",
        shortTitle: "GenAI Profile",
        geometry: {
          x: 77,
          y: 30,
          labelX: 108,
          labelY: 13,
          mobileLabelX: 75,
          direction: "diagonal",
        },
      },
      {
        corpusId: "writ.corpus.legal-policy.us.office-of-management-and-budget.m-25-21",
        shortTitle: "OMB M-25-21",
        geometry: {
          x: 20,
          y: 69,
          labelX: 12,
          labelY: 85,
          mobileLabelX: 35,
          direction: "diagonal",
          align: "end",
        },
      },
      {
        corpusId: "writ.corpus.legal-policy.us.white-house.americas-ai-action-plan",
        shortTitle: "AI Action Plan",
        geometry: {
          x: 72,
          y: 78,
          labelX: 104,
          labelY: 74,
          mobileLabelX: 75,
          direction: "right",
        },
      },
    ],
  },
  {
    family: "institutional",
    glyph: "EC",
    jurisdiction: "EU",
    records: [
      {
        corpusId: "eu.institutions.european_commission",
        shortTitle: "European Commission",
        geometry: { x: 73, y: 37, labelX: 93, labelY: 19, direction: "diagonal", align: "end" },
      },
    ],
  },
  {
    family: "institutional",
    glyph: "NIST",
    jurisdiction: "US",
    records: [
      {
        corpusId: "us.institutions.nist",
        shortTitle: "NIST",
        geometry: {
          x: 29,
          y: 67,
          labelX: -3,
          labelY: 83,
          mobileLabelX: 35,
          direction: "diagonal",
          align: "end",
        },
      },
    ],
  },
];

const DENSITY_POSITIONS: Record<GlyphName, readonly [number, number][]> = {
  EU: [
    [29, 29],
    [29, 42],
    [29, 55],
    [29, 68],
    [38, 29],
    [38, 49],
    [38, 68],
    [52, 30],
    [52, 55],
    [57, 69],
    [65, 72],
    [73, 69],
    [78, 55],
    [78, 30],
    [45, 49],
    [71, 43],
    [62, 72],
    [78, 43],
  ],
  US: [
    [29, 28],
    [29, 44],
    [29, 60],
    [35, 71],
    [45, 73],
    [52, 62],
    [52, 29],
    [62, 27],
    [72, 31],
    [73, 45],
    [62, 50],
    [54, 55],
    [62, 70],
    [73, 67],
    [77, 55],
    [40, 70],
    [53, 29],
    [68, 50],
  ],
  EC: [
    [29, 29],
    [29, 43],
    [29, 57],
    [29, 70],
    [39, 29],
    [39, 50],
    [39, 70],
    [56, 31],
    [50, 43],
    [50, 58],
    [57, 70],
    [68, 72],
    [76, 66],
    [79, 54],
    [79, 38],
    [72, 29],
    [61, 28],
    [47, 50],
  ],
  NIST: [
    [18, 34],
    [18, 50],
    [18, 66],
    [25, 42],
    [31, 55],
    [36, 66],
    [36, 35],
    [45, 34],
    [45, 50],
    [45, 66],
    [54, 34],
    [61, 34],
    [61, 50],
    [54, 66],
    [70, 34],
    [78, 34],
    [74, 50],
    [74, 66],
  ],
};

const GLYPH_REVEAL_START: Record<GlyphName, number> = {
  EU: 0.04,
  US: 0.18,
  EC: 0.45,
  NIST: 0.62,
};

function resolveCorpus(corpusId: string): CatalogCorpusSummary {
  const corpus = CATALOG_BY_ID.get(corpusId);
  if (!corpus) throw new Error(`${corpusId} is not present in ${CORPUS_CATALOG_SOURCE}`);
  return corpus;
}

function groupMappedCount(group: FeaturedGroup): number {
  if (group.family === "institutional") {
    return resolveCorpus(group.records[0]!.corpusId).mappedCount;
  }
  return CORPUS_CATALOG.filter(
    (corpus) => corpus.family === group.family && corpus.jurisdiction === group.jurisdiction,
  ).reduce((total, corpus) => total + corpus.mappedCount, 0);
}

function densityCellCount(count: number, familyMaximum: number): number {
  const tempered = familyMaximum > 0 ? Math.log1p(count) / Math.log1p(familyMaximum) : 0;
  const occupancy = 0.12 + tempered * 0.33;
  return Math.max(4, Math.round(DENSITY_POSITIONS.EU.length * occupancy));
}

function CorpusGlyph({
  group,
  selectedCorpusId,
  onSelect,
}: {
  group: FeaturedGroup;
  selectedCorpusId: string | null;
  onSelect: (corpusId: string) => void;
}) {
  const mappedCount = groupMappedCount(group);
  const familyMaximum = Math.max(
    ...FEATURED_GROUPS.filter(({ family }) => family === group.family).map(groupMappedCount),
  );
  const litCells = densityCellCount(mappedCount, familyMaximum);
  const isDraft = group.records.every(({ corpusId }) => resolveCorpus(corpusId).status === "draft");
  const relevant = selectedCorpusId
    ? group.records.some(({ corpusId }) => corpusId === selectedCorpusId)
    : true;

  return (
    <article
      className="corpus-canvas-group"
      data-glyph={group.glyph}
      data-relevant={relevant ? "true" : "false"}
      data-status={isDraft ? "draft" : "active"}
      style={{ "--group-start": GLYPH_REVEAL_START[group.glyph] } as MotionStyle}
      aria-label={`${group.glyph}: ${mappedCount} ${group.family === "legal_policy" ? "mapped claims" : "institutional records"}. Relative mapped density based on current Writ records; not a completeness estimate.`}
    >
      <div
        className="corpus-glyph-box"
        style={{ "--glyph-characters": group.glyph.length } as MotionStyle}
      >
        <span className="corpus-glyph-base" aria-hidden>
          {group.glyph}
        </span>
        <span className="corpus-density-cells" aria-hidden>
          {DENSITY_POSITIONS[group.glyph].slice(0, litCells).map(([x, y], index) => (
            <i
              key={`${x}-${y}-${index}`}
              style={{ "--density-x": `${x}%`, "--density-y": `${y}%` } as MotionStyle}
            />
          ))}
        </span>

        <span className="corpus-glyph-jurisdiction" aria-hidden>
          {group.jurisdiction}
        </span>
        {isDraft ? <span className="corpus-glyph-draft">draft</span> : null}
        <span className="corpus-glyph-count">
          {mappedCount}{" "}
          {group.family === "legal_policy" ? "mapped claims" : "institutional records"}
        </span>

        <svg className="corpus-node-lines" viewBox="0 0 100 100" aria-hidden>
          {group.records.map(({ corpusId, geometry }) => (
            <line
              key={corpusId}
              x1={geometry.x}
              y1={geometry.y}
              x2={geometry.labelX}
              y2={geometry.labelY}
              style={
                {
                  "--line-x2": `${geometry.labelX}%`,
                  "--line-x2-mobile": `${geometry.mobileLabelX ?? geometry.labelX}%`,
                } as MotionStyle
              }
              data-selected={selectedCorpusId === corpusId ? "true" : "false"}
            />
          ))}
        </svg>

        {group.records.map(({ corpusId, shortTitle, geometry }) => {
          const corpus = resolveCorpus(corpusId);
          const selected = selectedCorpusId === corpusId;
          const nodeStyle = {
            "--node-x": `${geometry.x}%`,
            "--node-y": `${geometry.y}%`,
            "--label-x": `${geometry.labelX}%`,
            "--label-y": `${geometry.labelY}%`,
            "--label-x-mobile": `${geometry.mobileLabelX ?? geometry.labelX}%`,
          } as MotionStyle;
          return (
            <div
              className="corpus-node-annotation"
              data-direction={geometry.direction}
              data-selected={selected ? "true" : "false"}
              key={corpusId}
              style={nodeStyle}
            >
              <button
                type="button"
                className="corpus-node"
                aria-label={`Focus ${shortTitle} corpus`}
                aria-pressed={selected}
                onClick={() => onSelect(corpusId)}
              >
                <span />
              </button>
              <span
                className="corpus-node-label"
                data-align={geometry.align ?? "start"}
                aria-hidden
              >
                <strong>{shortTitle}</strong>
                <small>{corpus.issuer}</small>
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function NodeCallout({
  corpus,
  shortTitle,
  onClose,
  onViewRaw,
}: {
  corpus: CatalogCorpusSummary;
  shortTitle: string;
  onClose: () => void;
  onViewRaw: () => void;
}) {
  return (
    <aside className="corpus-node-callout" aria-live="polite">
      <button
        type="button"
        className="corpus-callout-close"
        onClick={onClose}
        aria-label="Close corpus focus"
      >
        <X aria-hidden />
      </button>
      <p className="corpus-callout-title">{shortTitle}</p>
      {shortTitle === corpus.title ? null : (
        <p className="corpus-callout-canonical">{corpus.title}</p>
      )}
      <dl>
        <div>
          <dt>issuer</dt>
          <dd>{corpus.issuer}</dd>
        </div>
        <div>
          <dt>family</dt>
          <dd>{corpus.family}</dd>
        </div>
        <div>
          <dt>status</dt>
          <dd>{corpus.status}</dd>
        </div>
      </dl>
      <button type="button" className="corpus-view-raw" onClick={onViewRaw}>
        View raw code? <ArrowRight aria-hidden />
      </button>
    </aside>
  );
}

function RawWorkspace({ corpus, onClose }: { corpus: CatalogCorpusSummary; onClose: () => void }) {
  const files = corpus.rawFiles ?? [];
  const [activeIndex, setActiveIndex] = useState(Math.min(1, Math.max(0, files.length - 1)));
  const [isDesktop, setIsDesktop] = useState(true);
  const activeFile = files[activeIndex] as CatalogRawFile | undefined;

  useEffect(() => {
    const query = window.matchMedia("(min-width: 900px)");
    const update = () => setIsDesktop(query.matches);
    const frame = window.requestAnimationFrame(update);
    query.addEventListener("change", update);
    return () => {
      window.cancelAnimationFrame(frame);
      query.removeEventListener("change", update);
    };
  }, []);

  return (
    <div
      className="raw-workspace"
      role="dialog"
      aria-modal="true"
      aria-label={`Canonical source for ${corpus.title}`}
    >
      <header className="raw-workspace-toolbar">
        <div>
          <span>canonical source</span>
          <strong>{corpus.title}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close raw source workspace">
          <X aria-hidden />
        </button>
      </header>

      <div className="raw-workspace-files" role="tablist" aria-label="Canonical files">
        {files.map((file, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeIndex === index}
            key={file.path}
            onClick={() => setActiveIndex(index)}
          >
            {file.name}
          </button>
        ))}
      </div>

      <div className="raw-workspace-tool">
        <ResizablePanelGroup orientation={isDesktop ? "horizontal" : "vertical"}>
          <ResizablePanel defaultSize={isDesktop ? 64 : 62} minSize={32}>
            <div className="raw-workspace-editor">
              {activeFile ? (
                <RawSourceEditor
                  content={activeFile.content}
                  language={activeFile.language}
                  path={activeFile.path}
                />
              ) : (
                <span className="raw-workspace-loading">No embedded canonical source.</span>
              )}
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={isDesktop ? 36 : 38} minSize={24}>
            <div className="raw-workspace-inspection">
              <p>Structured inspection</p>
              <dl>
                <div>
                  <dt>corpus identity</dt>
                  <dd>{corpus.corpusId}</dd>
                </div>
                <div>
                  <dt>family</dt>
                  <dd>{corpus.family}</dd>
                </div>
                <div>
                  <dt>issuer / institution</dt>
                  <dd>{corpus.issuer}</dd>
                </div>
                <div>
                  <dt>status</dt>
                  <dd>{corpus.status}</dd>
                </div>
                <div>
                  <dt>canonical path</dt>
                  <dd>{corpus.path}</dd>
                </div>
                <div>
                  <dt>{corpus.mappedCountKind}</dt>
                  <dd>{corpus.mappedCount}</dd>
                </div>
                <div>
                  <dt>source files</dt>
                  <dd>{corpus.sourceFileCount}</dd>
                </div>
                <div>
                  <dt>unresolved evidence</dt>
                  <dd>{corpus.unresolvedEvidenceCount}</dd>
                </div>
              </dl>
              <p className="raw-workspace-density-note">
                Relative mapped density is based on current Writ records within this family; it is
                not a completeness estimate.
              </p>
              {activeFile ? <p className="raw-workspace-path">{activeFile.path}</p> : null}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export function CorpusNetwork() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedCorpusId, setSelectedCorpusId] = useState<string | null>(null);
  const [rawCorpusId, setRawCorpusId] = useState<string | null>(null);
  const selectedCorpus = selectedCorpusId ? resolveCorpus(selectedCorpusId) : null;
  const rawCorpus = rawCorpusId ? resolveCorpus(rawCorpusId) : null;
  const selectedPresentation = selectedCorpusId
    ? FEATURED_GROUPS.flatMap(({ records }) => records).find(
        ({ corpusId }) => corpusId === selectedCorpusId,
      )
    : null;

  const grouped = useMemo(
    () => ({
      legal: FEATURED_GROUPS.filter(({ family }) => family === "legal_policy"),
      institutional: FEATURED_GROUPS.filter(({ family }) => family === "institutional"),
    }),
    [],
  );

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactLayout = window.matchMedia("(max-width: 900px)");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (reducedMotion.matches || compactLayout.matches) {
        canvas.style.removeProperty("--corpus-progress");
        return;
      }
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / distance));
      canvas.style.setProperty("--corpus-progress", progress.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    reducedMotion.addEventListener("change", schedule);
    compactLayout.addEventListener("change", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
      compactLayout.removeEventListener("change", schedule);
    };
  }, []);

  useEffect(() => {
    if (!selectedCorpusId && !rawCorpusId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (rawCorpusId) setRawCorpusId(null);
      else setSelectedCorpusId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rawCorpusId, selectedCorpusId]);

  useEffect(() => {
    if (!rawCorpusId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [rawCorpusId]);

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".corpus-node, .corpus-node-callout")) return;
    setSelectedCorpusId(null);
  };

  return (
    <section
      ref={sectionRef}
      className="corpus-scroll-stage"
      data-focused={selectedCorpusId ? "true" : "false"}
      aria-labelledby="corpus-field-title"
      onPointerDown={handleCanvasPointerDown}
    >
      <h2 id="corpus-field-title" className="sr-only">
        Native Writ corpus families
      </h2>
      <p className="sr-only">
        Relative mapped density is based on current Writ records within each family; it is not a
        completeness estimate.
      </p>

      <div ref={canvasRef} className="corpus-sticky-canvas">
        <div className="corpus-canvas-ambient" aria-hidden />
        <div className="corpus-canvas-family corpus-canvas-family--legal">
          <p className="corpus-canvas-family-label">legal_policy</p>
          {grouped.legal.map((group) => (
            <CorpusGlyph
              key={group.glyph}
              group={group}
              selectedCorpusId={selectedCorpusId}
              onSelect={setSelectedCorpusId}
            />
          ))}
        </div>
        <div className="corpus-canvas-family corpus-canvas-family--institutional">
          <p className="corpus-canvas-family-label">institutional</p>
          {grouped.institutional.map((group) => (
            <CorpusGlyph
              key={group.glyph}
              group={group}
              selectedCorpusId={selectedCorpusId}
              onSelect={setSelectedCorpusId}
            />
          ))}
        </div>

        {selectedCorpus ? (
          <NodeCallout
            corpus={selectedCorpus}
            shortTitle={selectedPresentation?.shortTitle ?? selectedCorpus.title}
            onClose={() => setSelectedCorpusId(null)}
            onViewRaw={() => setRawCorpusId(selectedCorpus.corpusId)}
          />
        ) : null}
      </div>

      {rawCorpus ? (
        <RawWorkspace
          key={rawCorpus.corpusId}
          corpus={rawCorpus}
          onClose={() => setRawCorpusId(null)}
        />
      ) : null}
    </section>
  );
}
