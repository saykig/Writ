"use client";

import { Editor, type Monaco, type OnMount } from "@monaco-editor/react";

import { registerWrit } from "@/components/lab/writ-language";

const RAW_SOURCE_THEME_DARK = "writ-source-sumi";
const RAW_YAML_LANGUAGE_ID = "writ-yaml";

function registerRawYaml(monaco: Monaco): void {
  if (
    !monaco.languages
      .getLanguages()
      .some((language: { id: string }) => language.id === RAW_YAML_LANGUAGE_ID)
  ) {
    monaco.languages.register({ id: RAW_YAML_LANGUAGE_ID });
  }

  monaco.languages.setMonarchTokensProvider(RAW_YAML_LANGUAGE_ID, {
    tokenPostfix: ".yaml",
    tokenizer: {
      root: [
        [/#.*$/, "comment"],
        [/[A-Za-z_][\w.-]*(?=\s*:)/, "type"],
        [/:/, "operators"],
        [/---|\.\.\./, "operators"],
        [/[>|][0-9]*[+-]?$/, "operators"],
        [/"([^"\\]|\\.)*"/, "string"],
        [/'[^']*'/, "string"],
        [/\b(true|false|null)\b|~/i, "keyword"],
        [/\b\d{4}-\d{2}-\d{2}\b/, "number"],
        [/\b[+-]?\d+(?:\.\d+)*\b/, "number"],
        [/[&*][^\s]+/, "namespace"],
        [/![^\s]+/, "tag"],
        [/[\[\]{},]/, "delimiter"],
        [/-\s+/, "operators"],
        [/[^\s#[\]{},:]+/, "string"],
        [/\s+/, "white"],
      ],
    },
  });
}

function registerRawSourceTheme(monaco: Monaco): void {
  registerWrit(monaco);
  registerRawYaml(monaco);
  monaco.editor.defineTheme(RAW_SOURCE_THEME_DARK, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "858B91", fontStyle: "italic" },
      { token: "comment.yaml", foreground: "858B91", fontStyle: "italic" },
      { token: "type", foreground: "A8B8D0" },
      { token: "type.yaml", foreground: "A8B8D0" },
      { token: "keyword", foreground: "B6A2C1" },
      { token: "keyword.yaml", foreground: "B6A2C1" },
      { token: "constant", foreground: "B6A2C1" },
      { token: "string", foreground: "9FB79B" },
      { token: "string.yaml", foreground: "9FB79B" },
      { token: "number", foreground: "C4A469" },
      { token: "number.yaml", foreground: "C4A469" },
      { token: "namespace", foreground: "91B4B1" },
      { token: "namespace.yaml", foreground: "91B4B1" },
      { token: "tag", foreground: "91B4B1" },
      { token: "tag.yaml", foreground: "91B4B1" },
      { token: "operator", foreground: "8F98A3" },
      { token: "operators", foreground: "8F98A3" },
      { token: "operators.yaml", foreground: "8F98A3" },
      { token: "delimiter", foreground: "8F98A3" },
      { token: "delimiter.yaml", foreground: "8F98A3" },
      { token: "identifier", foreground: "ECE6D8" },
    ],
    colors: {
      "editor.background": "#1A1B22",
      "editor.foreground": "#ECE6D8",
      "editorLineNumber.foreground": "#62666C",
      "editorLineNumber.activeForeground": "#A8ADB4",
      "editor.selectionBackground": "#343843",
      "editorCursor.foreground": "#C4A469",
      "editor.lineHighlightBackground": "#00000000",
      "editorIndentGuide.background1": "#00000000",
    },
  });
}

export interface RawSourceEditorProps {
  content: string;
  language: "yaml" | "writ";
  path: string;
}

/** Read-only Monaco surface for exact canonical source embedded at build time. */
export default function RawSourceEditor({ content, language, path }: RawSourceEditorProps) {
  const handleBeforeMount = (monaco: Monaco) => registerRawSourceTheme(monaco);
  const handleMount: OnMount = (editor, monaco) => {
    registerRawYaml(monaco);
    monaco.editor.setTheme(RAW_SOURCE_THEME_DARK);
    const model = editor.getModel();
    if (language === "yaml" && model) monaco.editor.setModelLanguage(model, RAW_YAML_LANGUAGE_ID);
  };

  return (
    <Editor
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      language={language === "yaml" ? RAW_YAML_LANGUAGE_ID : language}
      path={`writ-canonical://${path}`}
      theme={RAW_SOURCE_THEME_DARK}
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
