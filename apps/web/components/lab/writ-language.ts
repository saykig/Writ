import type { Monaco } from "@monaco-editor/react";

/**
 * The `writ` editor language, ported verbatim from the original studio
 * (the retired legacy editor's `registerWrit`). One Monarch grammar for
 * the DSL and two themes keyed to the Seam palette — `writ-paper` (light)
 * and `writ-sumi` (dark). Registration is idempotent: calling it twice is a
 * no-op, so it is safe to run in Monaco's `beforeMount` on every editor mount.
 */

export const WRIT_LANGUAGE_ID = "writ";
export const WRIT_THEME_LIGHT = "writ-paper";
export const WRIT_THEME_DARK = "writ-sumi";

const KEYWORDS = [
  "language",
  "package",
  "version",
  "source",
  "uri",
  "media_type",
  "commitment",
  "title",
  "summit",
  "adopted",
  "subjects",
  "evaluation_window",
  "evidence_policy",
  "unknown_policy",
  "action_identity",
  "parameter",
  "allowed",
  "let",
  "score",
  "result",
  "priority",
  "when",
  "id",
  "otherwise",
  "assert",
  "exhaustive",
  "non_overlapping",
  "over",
  "in",
  "by",
  "scenario",
  "for",
  "given",
  "expect",
  "diagnostic",
  "and",
  "or",
  "not",
  "between",
  "distinct_by",
  "where",
  "predicate",
  "classify",
  "as",
];

const BUILTINS = ["count_distinct", "count", "exists", "all", "any", "sum", "max", "min"];

const TYPES = ["Int", "Truth", "Bool", "Decimal", "String", "Date"];

const CONSTS = [
  "strong",
  "weak",
  "counter",
  "true",
  "false",
  "unknown",
  "contested",
  "open_world",
  "closed_world",
  "propagate",
  "unresolved",
];

/** Per-theme token foreground palette. Hex values without a leading `#`. */
interface ThemePalette {
  faint: string;
  indigo: string;
  gold: string;
  green: string;
  contested: string;
  soft: string;
  ink: string;
}

function themeRules(fg: ThemePalette) {
  return [
    { token: "comment", foreground: fg.faint, fontStyle: "italic" },
    { token: "keyword", foreground: fg.indigo, fontStyle: "bold" },
    { token: "type", foreground: fg.gold },
    { token: "type.identifier", foreground: fg.indigo },
    { token: "string", foreground: fg.green },
    { token: "number", foreground: fg.gold },
    { token: "constant", foreground: fg.contested },
    { token: "operator", foreground: fg.soft },
    { token: "identifier", foreground: fg.ink },
    { token: "delimiter", foreground: fg.soft },
    { token: "delimiter.bracket", foreground: fg.soft },
  ];
}

/** Register the `writ` language and both Seam themes on a Monaco instance. */
export function registerWrit(monaco: Monaco): void {
  if (
    monaco.languages
      .getLanguages()
      .some((language: { id: string }) => language.id === WRIT_LANGUAGE_ID)
  ) {
    return;
  }

  monaco.languages.register({ id: WRIT_LANGUAGE_ID });

  monaco.languages.setMonarchTokensProvider(WRIT_LANGUAGE_ID, {
    keywords: KEYWORDS,
    builtins: BUILTINS,
    types: TYPES,
    consts: CONSTS,
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/"[^"]*"/, "string"],
        [/\b\d{4}-\d{2}-\d{2}\b/, "number"],
        [/\b\d+(\.\d+)?\b/, "number"],
        [
          /[A-Za-z_][A-Za-z0-9_]*/,
          {
            cases: {
              "@keywords": "keyword",
              "@builtins": "type.identifier",
              "@types": "type",
              "@consts": "constant",
              "@default": "identifier",
            },
          },
        ],
        [/[{}()[\]]/, "delimiter.bracket"],
        [/[<>=!]+|>=|<=|==/, "operator"],
        [/[;,.]/, "delimiter"],
      ],
      comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
    },
  });

  monaco.editor.defineTheme(WRIT_THEME_LIGHT, {
    base: "vs",
    inherit: true,
    rules: themeRules({
      faint: "8b8571",
      indigo: "384a68",
      gold: "9a7828",
      green: "3f6248",
      contested: "9a7828",
      soft: "55503f",
      ink: "1c1a15",
    }),
    colors: {
      "editor.background": "#f7f2e8",
      "editor.foreground": "#1c1a15",
      "editorLineNumber.foreground": "#b7ac93",
      "editorLineNumber.activeForeground": "#55503f",
      "editor.selectionBackground": "#e2d7bd",
      "editorCursor.foreground": "#9a7828",
      "editor.lineHighlightBackground": "#00000000",
      "editorIndentGuide.background1": "#00000000",
    },
  });

  monaco.editor.defineTheme(WRIT_THEME_DARK, {
    base: "vs-dark",
    inherit: true,
    rules: themeRules({
      faint: "6d6857",
      indigo: "93a8cf",
      gold: "c7a24e",
      green: "7fa886",
      contested: "c7a24e",
      soft: "a49e8d",
      ink: "ece6d8",
    }),
    colors: {
      "editor.background": "#1a1b22",
      "editor.foreground": "#ece6d8",
      "editorLineNumber.foreground": "#4a4638",
      "editorLineNumber.activeForeground": "#a49e8d",
      "editor.selectionBackground": "#33353f",
      "editorCursor.foreground": "#c7a24e",
      "editor.lineHighlightBackground": "#00000000",
      "editorIndentGuide.background1": "#00000000",
    },
  });
}
