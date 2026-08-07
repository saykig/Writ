"use client";

import { Editor, type Monaco } from "@monaco-editor/react";

import { WRIT_THEME_DARK, registerWrit } from "@/components/lab/writ-language";

export interface RawSourceEditorProps {
  content: string;
  language: "yaml" | "writ";
  path: string;
}

/** Read-only Monaco surface for exact canonical source embedded at build time. */
export default function RawSourceEditor({ content, language, path }: RawSourceEditorProps) {
  const handleBeforeMount = (monaco: Monaco) => registerWrit(monaco);

  return (
    <Editor
      beforeMount={handleBeforeMount}
      language={language}
      path={`writ-canonical://${path}`}
      theme={WRIT_THEME_DARK}
      value={content}
      loading={<span className="raw-workspace-loading">Loading canonical source…</span>}
      options={{
        ariaLabel: `Read-only canonical source: ${path}`,
        automaticLayout: true,
        contextmenu: true,
        domReadOnly: true,
        fixedOverflowWidgets: true,
        folding: true,
        fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, monospace",
        fontLigatures: false,
        fontSize: 12.5,
        glyphMargin: false,
        guides: { indentation: false },
        lineHeight: 21,
        minimap: { enabled: false },
        overviewRulerBorder: false,
        overviewRulerLanes: 0,
        padding: { top: 16, bottom: 16 },
        readOnly: true,
        renderLineHighlight: "none",
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        tabSize: 2,
        wordWrap: "off",
      }}
    />
  );
}
