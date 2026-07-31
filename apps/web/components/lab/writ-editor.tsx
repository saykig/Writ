"use client";

import { useEffect, useRef, useState } from "react";
import { Editor, type Monaco, type OnMount } from "@monaco-editor/react";

import { WRIT_LANGUAGE_ID, WRIT_THEME_DARK, WRIT_THEME_LIGHT, registerWrit } from "./writ-language";
import type { CompileDiagnostic, Finding } from "./types";

type CodeEditor = Parameters<OnMount>[0];

/** Decoration CSS for the gold gap seam, injected once (globals.css is off-limits). */
const GAP_DECORATION_CSS = `
.writ-gap-line { background: var(--gold-wash); }
.writ-gap-glyph { margin-left: 3px; width: 3px !important; background: var(--gold); }
`;

export interface WritEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Resolved theme; drives which Seam Monaco theme is active. */
  isDark: boolean;
  /** Compile diagnostics rendered as squiggles + hovers. */
  diagnostics: readonly CompileDiagnostic[];
  /** The active `WRT-SCORE-GAP` finding, if any — marks the `otherwise` line. */
  gap: Finding | null;
}

/**
 * WritEditor — a Monaco editor bound to the `writ` language and the two
 * Seam themes. It renders compile diagnostics as markers and, when the analyzer
 * reports an uncovered region, paints a gold gutter seam on the `otherwise`
 * clause via `deltaDecorations`. Loaded client-only (see `WritLab`).
 */
export default function WritEditor({ value, onChange, isDark, diagnostics, gap }: WritEditorProps) {
  const editorRef = useRef<CodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const [ready, setReady] = useState(false);

  const handleBeforeMount = (monaco: Monaco) => {
    registerWrit(monaco);
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setReady(true);
  };

  // Compile diagnostics → editor markers (squiggles + hover text).
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!ready || !editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    const markers = diagnostics
      .filter((d) => d.span)
      .map((d) => {
        const span = d.span!;
        const start = model.getPositionAt(span.offset);
        const end = model.getPositionAt(span.offset + Math.max(1, span.length));
        return {
          severity:
            d.severity === "error"
              ? monaco.MarkerSeverity.Error
              : d.severity === "warning"
                ? monaco.MarkerSeverity.Warning
                : monaco.MarkerSeverity.Info,
          message: `${d.code}: ${d.message}`,
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        };
      });
    monaco.editor.setModelMarkers(model, WRIT_LANGUAGE_ID, markers);
  }, [ready, diagnostics]);

  // Score-gap finding → gold seam decoration on the `otherwise` line.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!ready || !editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    const next: Parameters<CodeEditor["deltaDecorations"]>[1] = [];
    if (gap) {
      const matches = model.findMatches("otherwise", false, false, false, null, false);
      if (matches.length) {
        const line = matches[0].range.startLineNumber;
        next.push({
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "writ-gap-line",
            glyphMarginClassName: "writ-gap-glyph",
            overviewRuler: {
              color: isDark ? "#c7a24e" : "#9a7828",
              position: monaco.editor.OverviewRulerLane.Left,
            },
            glyphMarginHoverMessage: { value: `**${gap.code}** — ${gap.message}` },
          },
        });
      }
    }
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, next);
  }, [ready, gap, value, isDark]);

  return (
    <>
      <style>{GAP_DECORATION_CSS}</style>
      <Editor
        language={WRIT_LANGUAGE_ID}
        theme={isDark ? WRIT_THEME_DARK : WRIT_THEME_LIGHT}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        loading={
          <div className="flex h-full w-full items-center justify-center">
            <span className="label-mono animate-pulse">Loading editor…</span>
          </div>
        }
        options={{
          fontFamily: "var(--font-mono), 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace",
          fontSize: 13,
          lineHeight: 22,
          fontLigatures: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          glyphMargin: true,
          padding: { top: 14, bottom: 14 },
          renderLineHighlight: "none",
          smoothScrolling: true,
          guides: { indentation: false },
          overviewRulerLanes: 1,
          overviewRulerBorder: false,
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "off",
          ariaLabel: "Writ methodology source",
          fixedOverflowWidgets: true,
        }}
      />
    </>
  );
}
