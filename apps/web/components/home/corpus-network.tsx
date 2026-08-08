"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, X } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform } from "motion/react";

import {
  E_GLYPH,
  PixelGlyph,
  U_GLYPH,
  glyphCellPoint,
  type GlyphCell,
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

const AI_ACT_ID =
  "writ.corpus.legal-policy.eu.european-union.artificial-intelligence-act-2024-1689";
const INTERACTIVE_CELL_ID = "U-07-15";
const E_ORIGIN = { x: 14, y: 18 } as const;
const U_ORIGIN = { x: 130, y: 18 } as const;
const VIEWBOX = { height: 170, width: 270 } as const;
const ANNOTATION_END = { x: 280, y: 57 } as const;

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
function selectMappedCells(mappedCount: number): ReadonlySet<string> {
  const candidates = [...E_GLYPH.cells, ...U_GLYPH.cells].filter(
    ({ id }) => id !== INTERACTIVE_CELL_ID,
  );
  candidates.sort(
    (left, right) => stableCellScore(left, mappedCount) - stableCellScore(right, mappedCount),
  );
  return new Set(candidates.slice(0, 1).map(({ id }) => id));
}

function NodeCallout({
  corpus,
  onClose,
  onViewRaw,
}: {
  corpus: CatalogCorpusSummary;
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
      <p className="corpus-callout-title">AI Act</p>
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
  const [selected, setSelected] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const reducedProgress = useMotionValue(1);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const progress = reduceMotion ? reducedProgress : scrollYProgress;
  const familyOpacity = useTransform(progress, [0, 0.08], [0, 1]);
  const eShift = useTransform(progress, [0, 0.16, 0.38], [68, 68, 0]);
  const interactiveOpacity = useTransform(progress, [0.56, 0.7], [0, 1]);
  const interactivePointerEvents = useTransform(progress, [0, 0.69, 0.7], ["none", "none", "auto"]);
  const densityOpacity = useTransform(progress, [0.48, 0.64], [0, 1]);
  const corpus = resolveCorpus(AI_ACT_ID);
  const mappedCellIds = useMemo(() => selectMappedCells(corpus.mappedCount), [corpus.mappedCount]);
  const node = glyphCellPoint(U_GLYPH, INTERACTIVE_CELL_ID, U_ORIGIN);

  useEffect(() => {
    if (!selected && !rawOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (rawOpen) setRawOpen(false);
      else setSelected(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rawOpen, selected]);

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
      data-focused={selected ? "true" : "false"}
      aria-labelledby="corpus-field-title"
    >
      <h2 id="corpus-field-title" className="sr-only">
        Legal-policy corpus glyph prototype
      </h2>
      <p className="sr-only">
        Relative mapped density uses current Writ records and is not a completeness estimate.
      </p>

      <div className="corpus-prototype-sticky">
        <motion.p className="corpus-prototype-family" style={{ opacity: familyOpacity }}>
          legal_policy
        </motion.p>

        <div className="pixel-corpus-figure">
          <svg
            className="pixel-corpus-svg"
            viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
            role="img"
            aria-label="E resolves into EU from explicit Pixel cells"
          >
            <motion.g style={{ x: eShift }}>
              <PixelGlyph
                definition={E_GLYPH}
                mappedCellIds={mappedCellIds}
                origin={E_ORIGIN}
                progress={progress}
                revealRange={[0, 0.32]}
                selectedCellId={selected ? INTERACTIVE_CELL_ID : null}
              />
            </motion.g>
            <PixelGlyph
              definition={U_GLYPH}
              interactiveCellId={INTERACTIVE_CELL_ID}
              mappedCellIds={mappedCellIds}
              origin={U_ORIGIN}
              progress={progress}
              revealRange={[0.24, 0.62]}
              selectedCellId={selected ? INTERACTIVE_CELL_ID : null}
            />

            <motion.path
              className="pixel-corpus-hairline"
              d={`M ${node.x} ${node.y} L ${ANNOTATION_END.x} ${ANNOTATION_END.y}`}
              initial={false}
              animate={{ opacity: selected ? 1 : 0, pathLength: selected ? 1 : 0 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.text
              className="pixel-corpus-annotation"
              x={ANNOTATION_END.x - 2}
              y={ANNOTATION_END.y - 2}
              textAnchor="end"
              initial={false}
              animate={{ opacity: selected ? 1 : 0 }}
              transition={{ delay: selected ? 0.22 : 0, duration: 0.24, ease: "easeOut" }}
            >
              <tspan className="pixel-corpus-annotation-title">AI Act</tspan>
              <tspan x={ANNOTATION_END.x - 2} dy="9" className="pixel-corpus-annotation-issuer">
                European Union
              </tspan>
            </motion.text>
          </svg>

          <motion.button
            type="button"
            className="pixel-corpus-hit-target"
            style={{
              left: `${(node.x / VIEWBOX.width) * 100}%`,
              opacity: interactiveOpacity,
              pointerEvents: interactivePointerEvents,
              top: `${(node.y / VIEWBOX.height) * 100}%`,
            }}
            aria-label="Focus AI Act corpus"
            aria-pressed={selected}
            onClick={() => setSelected((current) => !current)}
          />

          <motion.p className="pixel-corpus-density-note" style={{ opacity: densityOpacity }}>
            mapped cells signal record density, never completeness
          </motion.p>
        </div>

        {selected ? (
          <NodeCallout
            corpus={corpus}
            onClose={() => setSelected(false)}
            onViewRaw={() => setRawOpen(true)}
          />
        ) : null}
      </div>

      {rawOpen ? <RawWorkspace corpus={corpus} onClose={() => setRawOpen(false)} /> : null}
    </section>
  );
}
