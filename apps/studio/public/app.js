/* Covenant Studio — client. Vanilla ES modules, no framework.
   Drives view routing, the Monaco-backed playground against the real
   /api endpoints, and the benchmark matrix. */

"use strict";

/* global window, document, fetch, localStorage, history, location, clearTimeout, setTimeout */

/* ----------------------------------------------------------- utilities */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function postJSON(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function memberLabel(id) {
  const special = {
    united_states: "United States",
    united_kingdom: "United Kingdom",
    european_union: "European Union",
  };
  return (
    special[id] ??
    id
      .split("_")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ")
  );
}

/* --------------------------------------------------------------- theme */
(function theme() {
  const toggle = $(".theme-toggle");
  const label = $(".theme-label");
  const stored = localStorage.getItem("cov-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let mode = stored ?? (prefersDark ? "sumi" : "paper");
  apply(mode);

  function apply(next) {
    mode = next;
    document.documentElement.setAttribute("data-theme", next);
    if (label) label.textContent = next;
    syncMonacoTheme();
  }
  toggle?.addEventListener("click", () => {
    apply(mode === "paper" ? "sumi" : "paper");
    localStorage.setItem("cov-theme", mode);
  });
})();

function currentThemeIsDark() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "sumi") return true;
  if (t === "paper") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function syncMonacoTheme() {
  if (window.monaco) {
    window.monaco.editor.setTheme(currentThemeIsDark() ? "covenant-sumi" : "covenant-paper");
  }
}

/* -------------------------------------------------------------- router */
const views = {
  thesis: $("#view-thesis"),
  playground: $("#view-playground"),
  benchmark: $("#view-benchmark"),
};
let benchmarkLoaded = false;
let playgroundReady = false;

function show(name) {
  if (!views[name]) name = "thesis";
  for (const [key, el] of Object.entries(views)) {
    const active = key === name;
    el.classList.toggle("is-active", active);
    el.hidden = !active;
  }
  $$(".nav-link").forEach((a) => a.classList.toggle("is-active", a.dataset.view === name));
  if (name === "playground") initPlayground();
  if (name === "benchmark") loadBenchmark();
  if (history.replaceState) history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-view]");
  if (!link) return;
  e.preventDefault();
  show(link.dataset.view);
});
window.addEventListener("hashchange", () => show(location.hash.replace("#", "")));
show(location.hash.replace("#", "") || "thesis");

/* ============================================================ PLAYGROUND */
let editor = null;
let examples = [];
let decorations = [];
let debounceTimer = null;

function initPlayground() {
  if (playgroundReady) return;
  playgroundReady = true;
  loadExamplesThenMonaco();
}

async function loadExamplesThenMonaco() {
  const data = await fetch("/api/examples").then((r) => r.json());
  examples = data.examples ?? [];
  renderExampleChips();
  populateMembers();
  bootMonaco();
}

function renderExampleChips() {
  const wrap = $(".pg-switch");
  wrap.innerHTML = examples
    .map(
      (ex, i) => `
      <button class="ex-chip${i === 0 ? " is-active" : ""}" data-ex="${esc(ex.id)}" role="tab">
        <span class="ex-dot" data-outcome="${esc(ex.outcome)}"></span>
        ${esc(ex.title)}
      </button>`,
    )
    .join("");
  wrap.addEventListener("click", (e) => {
    const chip = e.target.closest(".ex-chip");
    if (!chip) return;
    selectExample(chip.dataset.ex);
  });
}

function selectExample(id) {
  const ex = examples.find((x) => x.id === id);
  if (!ex || !editor) return;
  $$(".ex-chip").forEach((c) => c.classList.toggle("is-active", c.dataset.ex === id));
  const note = $("[data-example-note]");
  if (note) note.textContent = ex.note;
  editor.setValue(ex.source);
  runAnalysis();
}

/* ---- Monaco boot ---- */
function bootMonaco() {
  const CDN = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs";
  window.MonacoEnvironment = {
    getWorkerUrl() {
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(
        `self.MonacoEnvironment={baseUrl:'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/'};importScripts('${CDN}/base/worker/workerMain.js');`,
      )}`;
    },
  };
  window.require.config({ paths: { vs: CDN } });
  window.require(["vs/editor/editor.main"], () => {
    registerCovenant();
    const first = examples[0];
    editor = window.monaco.editor.create($("#editor"), {
      value: first ? first.source : "",
      language: "covenant",
      theme: currentThemeIsDark() ? "covenant-sumi" : "covenant-paper",
      fontFamily: "IBM Plex Mono, SF Mono, ui-monospace, monospace",
      fontSize: 13,
      lineHeight: 22,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      glyphMargin: true,
      padding: { top: 14, bottom: 14 },
      renderLineHighlight: "none",
      smoothScrolling: true,
      guides: { indentation: false },
      overviewRulerLanes: 0,
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    });
    const note = $("[data-example-note]");
    if (note && first) note.textContent = first.note;
    editor.onDidChangeModelContent(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runAnalysis, 350);
    });
    runAnalysis();
    wireReceiptControls();
  });
}

function registerCovenant() {
  const m = window.monaco;
  if (m.languages.getLanguages().some((l) => l.id === "covenant")) return;
  m.languages.register({ id: "covenant" });
  m.languages.setMonarchTokensProvider("covenant", {
    keywords: [
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
    ],
    builtins: ["count_distinct", "count", "exists", "all", "any", "sum", "max", "min"],
    types: ["Int", "Truth", "Bool", "Decimal", "String", "Date"],
    consts: [
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
    ],
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

  const base = {
    inherit: false,
    rules: (fg) => [
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
    ],
  };
  m.editor.defineTheme("covenant-paper", {
    base: "vs",
    inherit: true,
    rules: base.rules({
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
  m.editor.defineTheme("covenant-sumi", {
    base: "vs-dark",
    inherit: true,
    rules: base.rules({
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

/* ---- run compile + analyze, render everything ---- */
let lastFindings = [];
async function runAnalysis() {
  if (!editor) return;
  const source = editor.getValue();
  setCompileStatus("compiling…", "");
  const [compileRes, analyzeRes] = await Promise.all([
    postJSON("/api/compile", { source }),
    postJSON("/api/analyze", { source }),
  ]);
  lastFindings = analyzeRes.findings ?? [];
  applyMarkers(compileRes.diagnostics ?? []);
  applyGapDecoration(lastFindings);
  renderAnalysis(analyzeRes);
  renderIR(compileRes);
  updateCompileStatus(compileRes, analyzeRes);
  updateAnalysisBadge(analyzeRes);
}

function setCompileStatus(text, cls) {
  const el = $("[data-compile-status]");
  el.textContent = text;
  el.className = `pane-status${cls ? " " + cls : ""}`;
}
function updateCompileStatus(compileRes, analyzeRes) {
  const errors = (compileRes.diagnostics ?? []).filter((d) => d.severity === "error");
  if (errors.length) {
    setCompileStatus(`${errors.length} compile error${errors.length > 1 ? "s" : ""}`, "is-error");
  } else if ((analyzeRes.findings ?? []).length) {
    setCompileStatus("compiled · analysis findings", "");
  } else {
    setCompileStatus("compiled · schema-valid", "is-clean");
  }
}
function updateAnalysisBadge(analyzeRes) {
  const badge = $("[data-analysis-badge]");
  const n = (analyzeRes.findings ?? []).length;
  badge.textContent = n ? `(${n})` : "";
}

function applyMarkers(diagnostics) {
  if (!editor) return;
  const model = editor.getModel();
  const markers = diagnostics
    .filter((d) => d.span)
    .map((d) => {
      const start = model.getPositionAt(d.span.offset);
      const end = model.getPositionAt(d.span.offset + Math.max(1, d.span.length));
      return {
        severity:
          d.severity === "error"
            ? window.monaco.MarkerSeverity.Error
            : window.monaco.MarkerSeverity.Warning,
        message: `${d.code}: ${d.message}`,
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column,
      };
    });
  window.monaco.editor.setModelMarkers(model, "covenant", markers);
}

function applyGapDecoration(findings) {
  if (!editor) return;
  const model = editor.getModel();
  const newDecos = [];
  const gap = findings.find((f) => f.code === "COV-SCORE-GAP");
  if (gap) {
    const match = model.findMatches("otherwise", false, false, false, null, false);
    if (match.length) {
      const r = match[0].range;
      newDecos.push({
        range: new window.monaco.Range(r.startLineNumber, 1, r.startLineNumber, 1),
        options: {
          isWholeLine: true,
          className: "gap-line-deco",
          glyphMarginClassName: "gap-glyph",
          overviewRuler: { color: "#9a7828", position: 4 },
          hoverMessage: { value: `**${gap.code}** — ${gap.message}` },
        },
      });
    }
  }
  decorations = editor.deltaDecorations(decorations, newDecos);
}

/* ---- Analysis panel ---- */
function renderAnalysis(res) {
  const panel = $('[data-panel="analysis"]');
  const errors = (res.diagnostics ?? []).filter((d) => d.severity === "error");
  const findings = res.findings ?? [];
  let html = "";

  if (errors.length) {
    html += `<div class="analysis-status"><span class="status-pip error"></span>
      Source does not compile — ${errors.length} error${errors.length > 1 ? "s" : ""}.</div>`;
    html += errors
      .map(
        (d) =>
          `<div class="diag-line"><span class="diag-loc">${
            d.span ? `L${d.span.startLine}:${d.span.startColumn}` : ""
          }</span>${esc(d.code)} — ${esc(d.message)}</div>`,
      )
      .join("");
    panel.innerHTML = html;
    return;
  }

  if (!findings.length) {
    html += `<div class="analysis-status"><span class="status-pip clean"></span>
      Total and non-overlapping. Every input state is scored by exactly one rule.</div>
      <p class="muted">The static analyzer enumerated the score program's declared
      input space and found no gaps, overlaps, or unreachable rules.</p>`;
    panel.innerHTML = html;
    return;
  }

  html += `<div class="analysis-status"><span class="status-pip finding"></span>
    ${findings.length} finding${findings.length > 1 ? "s" : ""} in the score program.</div>`;
  html += findings.map(renderFinding).join("");
  panel.innerHTML = html;
}

function renderFinding(f) {
  const isOverlap = f.code === "COV-SCORE-OVERLAP";
  const witness = f.witness
    ? `<div class="witness-grid">${Object.entries(f.witness)
        .map(([k, v]) => `<span class="witness-chip"><em>${esc(k)}</em>${esc(String(v))}</span>`)
        .join("")}</div>`
    : "";
  return `<div class="finding${isOverlap ? " is-overlap" : ""}">
    <span class="finding-code">${esc(f.code)}</span>
    <p class="finding-msg">${esc(f.message)}</p>
    ${witness}
  </div>`;
}

/* ---- IR panel ---- */
function renderIR(res) {
  const panel = $('[data-panel="ir"]');
  if (!res.ir) {
    panel.innerHTML = `<p class="muted">No IR — resolve the compile errors on the left.</p>`;
    return;
  }
  const ir = res.ir;
  const c = ir.commitments?.[0];
  let html = `<dl class="ir-summary">
    <div class="ir-kv"><dt>package</dt><dd>${esc(ir.package?.name ?? "")}</dd></div>
    <div class="ir-kv"><dt>version</dt><dd>${esc(ir.package?.version ?? "")}</dd></div>
    <div class="ir-kv"><dt>language</dt><dd>${esc(ir.language_version ?? "")}</dd></div>
    <div class="ir-kv"><dt>schema</dt><dd>${res.schemaValid ? "valid ✓" : "invalid"}</dd></div>
    <div class="ir-kv"><dt>commitments</dt><dd>${ir.commitments?.length ?? 0}</dd></div>
  </dl>`;

  if (c) {
    html += `<p class="ir-section-h">${esc(c.id)} · variables (${c.variables?.length ?? 0})</p>`;
    html += `<dl class="ir-summary">${(c.variables ?? [])
      .map((v) => `<div class="ir-kv"><dt>${esc(v.id)}</dt><dd>${esc(v.type ?? "")}</dd></div>`)
      .join("")}</dl>`;

    const rules = c.score_program?.rules ?? [];
    html += `<p class="ir-section-h">score program (${rules.length} rules + otherwise)</p>`;
    html += rules
      .map(
        (r) => `<div class="ir-rule">
          <span class="ir-result">${esc(r.result)}</span>
          <span class="ir-prio">p${esc(r.priority)}</span>
          <span class="ir-rule-id">${esc(r.id)}</span>
        </div>`,
      )
      .join("");
    const other = c.score_program?.otherwise;
    if (other) {
      html += `<div class="ir-rule">
        <span class="ir-result">${esc(other.result ?? "unresolved")}</span>
        <span class="ir-prio">—</span>
        <span class="ir-rule-id">otherwise</span>
      </div>`;
    }
  }

  html += `<details class="ir-raw"><summary>Raw canonical IR</summary>
    <pre class="ir-json">${esc(JSON.stringify(ir, null, 2))}</pre></details>`;
  panel.innerHTML = html;
}

/* ---- Receipt panel ---- */
function populateMembers() {
  const select = $("#member-select");
  if (!select) return;
  const order = [
    "canada",
    "france",
    "germany",
    "italy",
    "japan",
    "united_kingdom",
    "united_states",
    "european_union",
  ];
  select.innerHTML = order
    .map(
      (id) =>
        `<option value="${id}"${id === "japan" ? " selected" : ""}>${esc(memberLabel(id))}</option>`,
    )
    .join("");
}

let activeProfile = "published";
function wireReceiptControls() {
  $$(".ptog").forEach((btn) =>
    btn.addEventListener("click", () => {
      activeProfile = btn.dataset.profile;
      $$(".ptog").forEach((b) => b.classList.toggle("is-active", b === btn));
    }),
  );
  $("[data-evaluate]")?.addEventListener("click", evaluateNow);
}

async function evaluateNow() {
  if (!editor) return;
  const member = $("#member-select").value;
  const out = $("[data-receipt-out]");
  out.innerHTML = `<p class="muted">Evaluating ${esc(memberLabel(member))} over the frozen snapshot…</p>`;
  const res = await postJSON("/api/evaluate", {
    source: editor.getValue(),
    member,
    profile: activeProfile,
  });
  renderReceipt(res, member);
}

function renderReceipt(res, member) {
  const out = $("[data-receipt-out]");
  if (!res.ok) {
    out.innerHTML = `<div class="finding"><span class="finding-code">EVALUATION BLOCKED</span>
      <p class="finding-msg">${esc(res.error ?? "Evaluation failed.")}</p></div>`;
    return;
  }
  const r = res.receipt;
  const badgeClass =
    r.result === "+1"
      ? "pos"
      : r.result === "-1"
        ? "neg"
        : r.result === "0"
          ? "zero"
          : "unresolved";
  const allActions = r.dependencies?.action_ids ?? [];
  const qualifying = new Set(r.qualifying_action_ids ?? []);
  const excluded = allActions.filter((a) => !qualifying.has(a));

  const hashRows = [
    ["methodology_bundle_hash", r.dependencies?.methodology_bundle_hash],
    ["evidence_snapshot_hash", r.dependencies?.evidence_snapshot_hash],
    ["interpretation_profile_hash", r.dependencies?.interpretation_profile_hash],
    ["evaluator_build_hash", r.dependencies?.evaluator_build_hash],
    ["canonical_hash", r.canonical_hash],
  ];

  out.innerHTML = `
    <div class="receipt-head">
      <div class="result-badge ${badgeClass}">${esc(r.result)}</div>
      <div class="receipt-meta">
        <div><strong>${esc(memberLabel(member))}</strong> ·
          <span class="status-tag">${esc(r.result_status)}</span></div>
        <div>matched rule <strong>${esc(r.matched_rule_id ?? "—")}</strong> ·
          profile <strong>${esc(res.profile)}</strong></div>
        <div>${qualifying.size} qualifying · ${r.proof?.nodes?.length ?? 0} proof nodes</div>
      </div>
    </div>

    <p class="receipt-sub-h">Rule evaluations</p>
    <div class="action-list">${(r.rule_evaluations ?? [])
      .map(
        (e) =>
          `<div class="action-row"><span class="action-mark ${
            e.truth_value === "true" ? "" : "excluded"
          }">${e.truth_value === "true" ? "●" : "○"}</span>
          <span>${esc(e.rule_id)}</span>
          <span class="ir-prio">p${esc(e.priority)}</span>
          <span style="margin-left:auto" class="ir-result">${esc(e.result)}</span>
          <span class="mono-label" style="letter-spacing:.04em">${esc(e.truth_value)}</span></div>`,
      )
      .join("")}</div>

    <p class="receipt-sub-h">Qualifying actions (${qualifying.size})</p>
    <div class="action-list">${[...qualifying]
      .map(
        (a) =>
          `<div class="action-row"><span class="action-mark">✓</span><span>${esc(a)}</span></div>`,
      )
      .join("")}</div>
    ${
      excluded.length
        ? `<p class="receipt-sub-h">Excluded / non-qualifying (${excluded.length})</p>
      <div class="action-list">${excluded
        .map(
          (a) =>
            `<div class="action-row"><span class="action-mark excluded">–</span><span>${esc(a)}</span></div>`,
        )
        .join("")}</div>`
        : ""
    }

    <p class="receipt-sub-h">Proof</p>
    <div class="proof-tree" data-proof></div>

    <p class="receipt-sub-h">Content hashes</p>
    <dl class="hash-list">${hashRows
      .map(([k, v]) => `<div class="hash-row"><dt>${esc(k)}</dt><dd>${esc(v ?? "—")}</dd></div>`)
      .join("")}</dl>`;

  renderProofTree($("[data-proof]", out), r.proof);
}

/* ---- proof tree (collapsible) ---- */
function truthClass(tv) {
  return (
    { true: "tv-true", false: "tv-false", unknown: "tv-unknown", contested: "tv-contested" }[tv] ??
    "tv-unknown"
  );
}
function renderProofTree(container, proof) {
  if (!proof || !proof.nodes) {
    container.innerHTML = `<p class="muted">No proof.</p>`;
    return;
  }
  const byId = new Map(proof.nodes.map((n) => [n.id, n]));
  const seen = new Set();

  function node(id, depth) {
    const n = byId.get(id);
    if (!n || seen.has(id)) return "";
    seen.add(id);
    const children = (n.child_ids ?? []).filter((c) => byId.has(c));
    const collapsed = depth >= 2 && children.length;
    const toggle = children.length
      ? `<button class="proof-toggle" data-toggle>${collapsed ? "+" : "−"}</button>`
      : `<span class="proof-toggle"> </span>`;
    const value =
      n.value !== undefined ? ` <span class="proof-value">= ${esc(n.value)}</span>` : "";
    const childHtml = children.length
      ? `<div class="proof-children${collapsed ? " collapsed" : ""}">${children
          .map((c) => node(c, depth + 1))
          .join("")}</div>`
      : "";
    return `<div class="proof-node">
      <div class="proof-row">${toggle}
        <span class="proof-tv ${truthClass(n.truth_value)}">${esc(n.truth_value ?? "·")}</span>
        <span class="proof-kind">${esc(n.kind)}</span>
        <span class="proof-label">${esc(n.label ?? "")}${value}</span>
      </div>${childHtml}</div>`;
  }

  container.innerHTML = node(proof.root_id, 0);
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-toggle]");
    if (!btn) return;
    const kids = btn.closest(".proof-node").querySelector(".proof-children");
    if (!kids) return;
    const nowCollapsed = kids.classList.toggle("collapsed");
    btn.textContent = nowCollapsed ? "+" : "−";
  });
}

/* --------------------------------------------------------- result tabs */
$$(".rtab").forEach((tab) =>
  tab.addEventListener("click", () => {
    $$(".rtab").forEach((t) => t.classList.toggle("is-active", t === tab));
    $$(".rpanel").forEach((p) =>
      p.classList.toggle("is-active", p.dataset.panel === tab.dataset.tab),
    );
  }),
);

/* ============================================================= BENCHMARK */
async function loadBenchmark() {
  if (benchmarkLoaded) return;
  benchmarkLoaded = true;
  const data = await fetch("/api/benchmark").then((r) => r.json());
  renderBenchmark(data);
  const foot = $("[data-foot-version]");
  if (foot) foot.textContent = data.methodologyVersionId ?? "";
}

function scoreClass(v) {
  return v === "+1" ? "pos" : v === "-1" ? "neg" : "";
}

function renderBenchmark(data) {
  const out = $("[data-benchmark-out]");
  const cells = data.cells ?? [];
  const s = data.summary ?? {};

  let html = `<div class="bm-summary">
    <div class="figure-inline"><dt>Cells reproduced</dt><dd>${s.cells ?? cells.length}</dd></div>
    <div class="figure-inline"><dt>Match published</dt><dd>${s.matches ?? 0}</dd></div>
    <div class="figure-inline"><dt>Interpretation-sensitive</dt><dd>${
      s.interpretation_sensitive_cells ?? 0
    }</dd></div>
    <div class="figure-inline"><dt>Commitment</dt><dd style="font-family:var(--mono);font-size:.9rem">${esc(
      data.commitmentId ?? "",
    )}</dd></div>
  </div>`;

  html += `<div class="bm-matrix">
    <div class="bm-mrow head">
      <span>Member</span><span>Published</span><span>Computed</span>
      <span class="bm-generous-col">Generous</span><span>Reading</span>
    </div>`;

  html += cells
    .map((c) => {
      const generousCell = c.flips
        ? `<span class="bm-flip">${esc(c.computed)} <span class="flip-arrow">→</span> ${esc(
            c.generous,
          )}</span>`
        : `<span class="bm-stable">${esc(c.generous)}</span>`;
      const seamNote = c.sensitive
        ? `<span class="bm-seam-note">holds only under the strict reading</span>`
        : "";
      return `<div class="bm-mrow${c.sensitive ? " sensitive" : ""}">
        <div class="bm-member">${esc(memberLabel(c.member))}${seamNote}</div>
        <div class="bm-score ${scoreClass(c.published)}">${esc(c.published)}</div>
        <div class="bm-score ${scoreClass(c.computed)}">${esc(c.computed)}
          ${c.match ? '<span class="bm-check">✓</span>' : ""}</div>
        <div class="bm-generous-col">${generousCell}</div>
        <div class="bm-note">${esc(c.note)}</div>
      </div>`;
    })
    .join("");
  html += `</div>`;
  out.innerHTML = html;
}
