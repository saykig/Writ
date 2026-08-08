"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { ArrowRight, X } from "lucide-react";
import type { MotionValue } from "motion/react";
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform } from "motion/react";

import {
  E_GLYPH,
  PixelGlyph,
  S_GLYPH,
  U_GLYPH,
  glyphCellPoint,
  type GlyphCell,
  type PixelCellPoint,
  type PixelGlyphDefinition,
} from "@/components/home/pixel-glyph";
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

type FeaturedGlyph = "E" | "S" | "U";
type FeaturedJurisdiction = "EU" | "US";
type TextAnchor = "end" | "middle" | "start";

interface FeaturedCorpusNode {
  readonly cellId: string;
  readonly corpusId: string;
  readonly elbow: PixelCellPoint;
  readonly end: PixelCellPoint;
  readonly glyph: FeaturedGlyph;
  readonly jurisdiction: FeaturedJurisdiction;
  readonly label: string;
  readonly textAnchor: TextAnchor;
}

interface ResolvedFeaturedCorpusNode extends FeaturedCorpusNode {
  readonly corpus: CatalogCorpusSummary;
  readonly point: PixelCellPoint;
}

const VIEWBOX = { height: 280, width: 360 } as const;
const GLYPH_DEFINITIONS: Readonly<Record<FeaturedGlyph, PixelGlyphDefinition>> = {
  E: E_GLYPH,
  S: S_GLYPH,
  U: U_GLYPH,
};
const GLYPH_ORIGINS: Readonly<
  Record<FeaturedJurisdiction, Readonly<Partial<Record<FeaturedGlyph, PixelCellPoint>>>>
> = {
  EU: { E: { x: 64, y: 6 }, U: { x: 180, y: 6 } },
  US: { S: { x: 183, y: 150 }, U: { x: 67, y: 150 } },
};

/** Curated homepage presentation subset. Canonical catalog identity remains unchanged. */
const FEATURED_CORPORA: readonly FeaturedCorpusNode[] = [
  {
    corpusId: "writ.corpus.legal-policy.eu.european-union.artificial-intelligence-act-2024-1689",
    label: "AI Act",
    jurisdiction: "EU",
    glyph: "U",
    cellId: "U-07-15",
    elbow: { x: 307, y: 42 },
    end: { x: 338, y: 29 },
    textAnchor: "end",
  },
  {
    corpusId: "writ.corpus.legal-policy.eu.european-commission.gpai-guidelines",
    label: "GPAI Guidelines",
    jurisdiction: "EU",
    glyph: "U",
    cellId: "U-12-14",
    elbow: { x: 280, y: 85 },
    end: { x: 283, y: 85 },
    textAnchor: "start",
  },
  {
    corpusId:
      "writ.corpus.legal-policy.eu.european-commission.gpai-code-of-practice-signatory-notice",
    label: "Code of Practice notice",
    jurisdiction: "EU",
    glyph: "E",
    cellId: "E-08-13",
    elbow: { x: 126, y: 38 },
    end: { x: 112, y: 31 },
    textAnchor: "middle",
  },
  {
    corpusId: "eu.institutions.european_commission",
    label: "European Commission",
    jurisdiction: "EU",
    glyph: "E",
    cellId: "E-17-13",
    elbow: { x: 112, y: 128 },
    end: { x: 28, y: 138 },
    textAnchor: "start",
  },
  {
    corpusId: "writ.corpus.legal-policy.us.nist.ai-risk-management-framework-1-0",
    label: "NIST RMF",
    jurisdiction: "US",
    glyph: "U",
    cellId: "U-03-02",
    elbow: { x: 54, y: 165 },
    end: { x: 17, y: 157 },
    textAnchor: "start",
  },
  {
    corpusId: "writ.corpus.legal-policy.us.nist.generative-ai-profile",
    label: "GenAI Profile",
    jurisdiction: "US",
    glyph: "U",
    cellId: "U-12-15",
    elbow: { x: 179, y: 226 },
    end: { x: 172, y: 220 },
    textAnchor: "end",
  },
  {
    corpusId: "writ.corpus.legal-policy.us.office-of-management-and-budget.m-25-21",
    label: "OMB M-25-21",
    jurisdiction: "US",
    glyph: "U",
    cellId: "U-17-08",
    elbow: { x: 78, y: 263 },
    end: { x: 16, y: 266 },
    textAnchor: "start",
  },
  {
    corpusId: "writ.corpus.legal-policy.us.white-house.americas-ai-action-plan",
    label: "AI Action Plan",
    jurisdiction: "US",
    glyph: "S",
    cellId: "S-04-14",
    elbow: { x: 310, y: 162 },
    end: { x: 344, y: 142 },
    textAnchor: "end",
  },
  {
    corpusId: "us.institutions.nist",
    label: "NIST",
    jurisdiction: "US",
    glyph: "S",
    cellId: "S-15-02",
    elbow: { x: 258, y: 257 },
    end: { x: 344, y: 266 },
    textAnchor: "end",
  },
] as const;

const CATALOG_BY_ID = new Map(CORPUS_CATALOG.map((corpus) => [corpus.corpusId, corpus]));

function resolveCorpus(corpusId: string): CatalogCorpusSummary {
  const corpus = CATALOG_BY_ID.get(corpusId);
  if (!corpus) throw new Error(`${corpusId} is not present in ${CORPUS_CATALOG_SOURCE}`);
  return corpus;
}

function stableCellScore(cell: GlyphCell, seed: number): number {
  let hash = 2166136261 ^ seed;
  for (let index = 0; index < cell.id.length; index += 1) {
    hash ^= cell.id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Density is a deterministic choice among real cells, never a completion percentage. */
function selectMappedCells(
  definitions: readonly PixelGlyphDefinition[],
  mappedCount: number,
  interactiveCellIds: ReadonlySet<string>,
): ReadonlySet<string> {
  const candidates = definitions
    .flatMap(({ cells }) => cells)
    .filter(({ id }) => !interactiveCellIds.has(id));
  candidates.sort(
    (left, right) => stableCellScore(left, mappedCount) - stableCellScore(right, mappedCount),
  );
  return new Set(candidates.slice(0, 1).map(({ id }) => id));
}

function glyphOrigin(jurisdiction: FeaturedJurisdiction, glyph: FeaturedGlyph): PixelCellPoint {
  const origin = GLYPH_ORIGINS[jurisdiction][glyph];
  if (!origin) throw new Error(`${glyph} is not part of the ${jurisdiction} homepage glyph`);
  return origin;
}

function selectedCell(
  selected: ResolvedFeaturedCorpusNode | null,
  jurisdiction: FeaturedJurisdiction,
  glyph: FeaturedGlyph,
): string | null {
  return selected?.jurisdiction === jurisdiction && selected.glyph === glyph
    ? selected.cellId
    : null;
}

function CorpusAnnotation({
  index,
  node,
  progress,
  selected,
}: {
  index: number;
  node: ResolvedFeaturedCorpusNode;
  progress: MotionValue<number>;
  selected: boolean;
}) {
  const rowStart = node.jurisdiction === "EU" ? 0.2 : 0.34;
  const start = rowStart + index * 0.018;
  const end = start + 0.13;
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const pathLength = useTransform(progress, [start, end], [0, 1]);
  const labelOffset = node.textAnchor === "start" ? 3 : node.textAnchor === "end" ? -3 : 0;

  return (
    <motion.g
      className="pixel-corpus-annotation-group"
      data-selected={selected ? "true" : "false"}
      style={{ opacity }}
    >
      <motion.path
        className="pixel-corpus-hairline"
        d={`M ${node.point.x} ${node.point.y} L ${node.elbow.x} ${node.elbow.y} L ${node.end.x} ${node.end.y}`}
        style={{ pathLength }}
      />
      <text
        className="pixel-corpus-annotation"
        x={node.end.x + labelOffset}
        y={node.end.y - 2}
        textAnchor={node.textAnchor}
      >
        {node.label}
      </text>
    </motion.g>
  );
}

function NodeCallout({
  corpus,
  label,
  onClose,
  onViewRaw,
}: {
  corpus: CatalogCorpusSummary;
  label: string;
  onClose: () => void;
  onViewRaw: () => void;
}) {
  return (
    <aside id="corpus-node-detail" className="corpus-node-callout" aria-live="polite">
      <button
        type="button"
        className="corpus-callout-close"
        onClick={onClose}
        aria-label="Close corpus focus"
      >
        <X aria-hidden />
      </button>
      <p className="corpus-callout-title">{label}</p>
      <p className="corpus-callout-canonical">{corpus.title}</p>
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
  const [selectedCorpusId, setSelectedCorpusId] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const reducedProgress = useMotionValue(1);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const progress = reduceMotion ? reducedProgress : scrollYProgress;
  const eShift = useTransform(progress, [0, 0.1, 0.22], [68, 68, 0]);
  const interactiveOpacity = useTransform(progress, [0.42, 0.52], [0, 1]);
  const interactivePointerEvents = useTransform(
    progress,
    [0, 0.51, 0.52],
    ["none", "none", "auto"],
  );
  const densityOpacity = useTransform(progress, [0.44, 0.56], [0, 1]);
  const featuredNodes = useMemo<readonly ResolvedFeaturedCorpusNode[]>(
    () =>
      FEATURED_CORPORA.map((node) => ({
        ...node,
        corpus: resolveCorpus(node.corpusId),
        point: glyphCellPoint(
          GLYPH_DEFINITIONS[node.glyph],
          node.cellId,
          glyphOrigin(node.jurisdiction, node.glyph),
        ),
      })),
    [],
  );
  const selectedNode = featuredNodes.find(({ corpusId }) => corpusId === selectedCorpusId) ?? null;
  const selectionActive = selectedNode !== null;
  const euInteractiveCellIds = useMemo(
    () =>
      new Set(
        FEATURED_CORPORA.filter(({ jurisdiction }) => jurisdiction === "EU").map(
          ({ cellId }) => cellId,
        ),
      ),
    [],
  );
  const usInteractiveCellIds = useMemo(
    () =>
      new Set(
        FEATURED_CORPORA.filter(({ jurisdiction }) => jurisdiction === "US").map(
          ({ cellId }) => cellId,
        ),
      ),
    [],
  );
  const euMappedCount = featuredNodes
    .filter(({ jurisdiction }) => jurisdiction === "EU")
    .reduce((total, { corpus }) => total + corpus.mappedCount, 0);
  const usMappedCount = featuredNodes
    .filter(({ jurisdiction }) => jurisdiction === "US")
    .reduce((total, { corpus }) => total + corpus.mappedCount, 0);
  const euMappedCellIds = useMemo(
    () => selectMappedCells([E_GLYPH, U_GLYPH], euMappedCount, euInteractiveCellIds),
    [euInteractiveCellIds, euMappedCount],
  );
  const usMappedCellIds = useMemo(
    () => selectMappedCells([U_GLYPH, S_GLYPH], usMappedCount, usInteractiveCellIds),
    [usInteractiveCellIds, usMappedCount],
  );

  useEffect(() => {
    if (!selectedNode && !rawOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (rawOpen) setRawOpen(false);
      else setSelectedCorpusId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rawOpen, selectedNode]);

  useEffect(() => {
    if (!rawOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [rawOpen]);

  return (
    <section
      ref={sectionRef}
      className="corpus-prototype-stage"
      data-focused={selectionActive ? "true" : "false"}
      aria-labelledby="corpus-field-title"
    >
      <h2 id="corpus-field-title" className="sr-only">
        Featured EU and US corpora
      </h2>
      <p className="sr-only">
        Nine featured corpora are represented by illuminated cells inside the EU and US glyphs.
        Relative mapped density uses current Writ records and is not a completeness estimate.
      </p>

      <div className="corpus-prototype-sticky">
        <div className="pixel-corpus-figure">
          <svg
            className="pixel-corpus-svg"
            viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
            role="img"
            aria-label="EU above US, constructed from explicit Pixel cells with nine corpus annotations"
          >
            <motion.g style={{ x: eShift }}>
              <PixelGlyph
                definition={E_GLYPH}
                interactiveCellIds={euInteractiveCellIds}
                mappedCellIds={euMappedCellIds}
                origin={glyphOrigin("EU", "E")}
                progress={progress}
                revealRange={[0, 0.16]}
                selectionActive={selectionActive}
                selectedCellId={selectedCell(selectedNode, "EU", "E")}
              />
            </motion.g>
            <PixelGlyph
              definition={U_GLYPH}
              interactiveCellIds={euInteractiveCellIds}
              mappedCellIds={euMappedCellIds}
              origin={glyphOrigin("EU", "U")}
              progress={progress}
              revealRange={[0.06, 0.22]}
              selectionActive={selectionActive}
              selectedCellId={selectedCell(selectedNode, "EU", "U")}
            />
            <PixelGlyph
              definition={U_GLYPH}
              interactiveCellIds={usInteractiveCellIds}
              mappedCellIds={usMappedCellIds}
              origin={glyphOrigin("US", "U")}
              progress={progress}
              revealRange={[0.12, 0.28]}
              selectionActive={selectionActive}
              selectedCellId={selectedCell(selectedNode, "US", "U")}
            />
            <PixelGlyph
              definition={S_GLYPH}
              interactiveCellIds={usInteractiveCellIds}
              mappedCellIds={usMappedCellIds}
              origin={glyphOrigin("US", "S")}
              progress={progress}
              revealRange={[0.18, 0.34]}
              selectionActive={selectionActive}
              selectedCellId={selectedCell(selectedNode, "US", "S")}
            />

            {featuredNodes.map((node, index) => (
              <CorpusAnnotation
                key={node.corpusId}
                index={index}
                node={node}
                progress={progress}
                selected={node.corpusId === selectedCorpusId}
              />
            ))}
          </svg>

          {featuredNodes.map((node) => {
            const selected = node.corpusId === selectedCorpusId;
            return (
              <motion.button
                key={node.corpusId}
                type="button"
                className="pixel-corpus-hit-target"
                data-cell-id={node.cellId}
                data-corpus-id={node.corpusId}
                style={{
                  left: `${(node.point.x / VIEWBOX.width) * 100}%`,
                  opacity: interactiveOpacity,
                  pointerEvents: interactivePointerEvents,
                  top: `${(node.point.y / VIEWBOX.height) * 100}%`,
                }}
                aria-controls={selected ? "corpus-node-detail" : undefined}
                aria-label={`Show ${node.label} corpus details`}
                aria-pressed={selected}
                onClick={() => {
                  setRawOpen(false);
                  setSelectedCorpusId((current) =>
                    current === node.corpusId ? null : node.corpusId,
                  );
                }}
              />
            );
          })}

          <motion.p className="pixel-corpus-density-note" style={{ opacity: densityOpacity }}>
            mapped cells signal record density, never completeness
          </motion.p>
        </div>

        {selectedNode ? (
          <NodeCallout
            corpus={selectedNode.corpus}
            label={selectedNode.label}
            onClose={() => setSelectedCorpusId(null)}
            onViewRaw={() => setRawOpen(true)}
          />
        ) : null}
      </div>

      {rawOpen && selectedNode
        ? createPortal(
            <RawWorkspace corpus={selectedNode.corpus} onClose={() => setRawOpen(false)} />,
            document.body,
          )
        : null}
    </section>
  );
}
