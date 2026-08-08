import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB_ROOT = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(WEB_ROOT, path), "utf8");

describe("frontend architecture", () => {
  test("the working surfaces lead with the work, not with a hero", () => {
    // Writ Lab opens on the readings chooser and Start Here on its evidence
    // story; neither carries a generic page header above the thing it is for.
    for (const path of ["app/lab/page.tsx", "app/start-here/page.tsx"]) {
      expect(read(path)).not.toContain("PageHeader");
    }
    // Corpus is a grouped reading index, not a generated-answer or preset-question surface.
    const browser = read("components/corpus/corpus-browser.tsx");
    expect(browser).toContain("CorpusGroupList");
    expect(browser).toContain("Search records…");
    expect(browser).toContain("Record inspector");
    expect(browser).not.toContain("Policy questions");
    expect(browser).not.toContain("Important distinctions");
    expect(browser).not.toContain("Corpus and query versions");
  });

  test("the Lab is the tool, with no page header above it", () => {
    const lab = read("app/lab/page.tsx");

    // The record and its passage are the only framing; no hero competes with them.
    expect(lab).not.toContain("PageHeader");
    expect(lab).not.toContain("eyebrow=");
  });

  test("the homepage hero offers one resolving Start Here link", () => {
    const home = `${read("app/page.tsx")}\n${read("components/home/home-intro.tsx")}`;

    expect(home).toContain("Write in Writ.");
    expect(home).toContain(
      "Writ turns complex political and institutional information into structured,",
    );
    expect(home).not.toContain("Ask a question");
    expect(home).not.toContain("Build a corpus");
    expect(home).toContain('const HOW_WRIT_WORKS = "See how Writ works"');
    expect(home).toContain('href="/start-here"');
    expect(home).toContain("home-motion-resolving-link-code");
    expect(home).toContain("home-motion-resolving-link-final");
    expect(home).toContain("howItWorksActiveRef.current");
    expect(home).toContain("const shouldBeActive = latest >= 0.84");
    expect(home).toContain("setHowItWorksActive(shouldBeActive)");
    expect(home).toContain("latest >= 0.84");
    expect(home).not.toContain('href="/query"');
    expect(home).not.toContain('href="/build"');

    // The retired actions are gone rather than reworded.
    expect(home).not.toContain("See a worked answer");
    expect(home).not.toContain(">Try Writ</Link>");
    expect(home).not.toContain("Try the Writ Lab");
    expect(home).not.toContain('variant="outline"');
    expect(home).not.toContain('variant="ghost"');
  });

  test("the retired routes redirect permanently to their replacements", () => {
    const config = read("next.config.ts");
    expect(config).toContain('source: "/playground"');
    expect(config).toContain('destination: "/lab"');
    expect(config).toContain('source: "/demo"');
    expect(config).toContain('source: "/query"');
    expect(config).toContain('destination: "/corpus"');
    expect(config).toContain("permanent: true");
  });

  test("the nav leads with Start Here and preserves the working destinations", () => {
    const navItems = read("components/site/nav-items.ts");

    // Start Here answers what the product is before the working routes.
    expect(navItems).toContain('label: "Start Here"');
    expect(navItems).toContain('href: "/start-here"');
    expect(navItems).toContain('label: "Corpus"');
    expect(navItems).toContain('href: "/corpus"');
    expect(navItems).toContain('label: "Build"');
    expect(navItems).toContain('label: "Lab"');
    expect(navItems).not.toContain('label: "How it works"');
    expect(read("components/site/site-footer.tsx")).toContain("FOOTER_NAV");
    for (const removed of ["Demo", "Writ Lab", "Benchmark", "Methodologies", "Receipts"]) {
      expect(navItems).not.toContain(`label: "${removed}"`);
    }
    // The retired groups are gone rather than left dangling.
    expect(navItems).not.toContain("SECONDARY_NAV");
    expect(navItems).not.toContain("RESEARCH_NAV");

    for (const page of [
      "app/page.tsx",
      "app/start-here/page.tsx",
      "app/corpus/page.tsx",
      "app/build/page.tsx",
      "app/how-it-works/page.tsx",
      "app/lab/page.tsx",
    ]) {
      expect(existsSync(resolve(WEB_ROOT, page))).toBe(true);
    }
    for (const gone of [
      "app/benchmark",
      "app/methodologies",
      "app/receipts",
      "app/demo-analysis",
      "app/playground",
      "app/demo",
      "app/query/page.tsx",
    ]) {
      expect(existsSync(resolve(WEB_ROOT, gone))).toBe(false);
    }
  });

  test("archive is absent from routes and navigation", () => {
    expect(existsSync(resolve(WEB_ROOT, "app/archive"))).toBe(false);
    expect(read("components/site/nav-items.ts").toLowerCase()).not.toContain("archive");
  });

  test("about is not exposed as a route", () => {
    // The homepage was reduced to the hero in "Simplify homepage to hero", which
    // removed the explanatory copy this test used to assert. What still holds is
    // the original intent: there is no About route and no About nav entry.
    const home = read("app/page.tsx");
    expect(existsSync(resolve(WEB_ROOT, "app/about/page.tsx"))).toBe(false);
    expect(home).not.toContain(
      "Institutional compliance methodologies are written for human analysts.",
    );
    expect(home).not.toContain("Why Writ?");
    expect(read("components/site/nav-items.ts").toLowerCase()).not.toContain("about");
  });

  test("the command palette wraps its parts in the cmdk root", () => {
    // Every Command part reads its store from this context. Without the root
    // the input throws on mount and the whole palette is dead, which is not
    // visible until someone presses ⌘K.
    const command = read("components/ui/command.tsx");
    const dialogBody = command.slice(command.indexOf("function CommandDialog"));
    expect(dialogBody).toContain("<Command");
    expect(dialogBody).toMatch(/<Command[^>]*>\{children\}<\/Command>/);
  });

  test("the header has no visible search or benchmark CTA", () => {
    const nav = read("components/site/site-nav.tsx");
    expect(nav).not.toContain("Search");
    expect(nav).not.toContain("Explore the G7 example");
  });

  test("the shared nav keeps the homepage chrome while hiding its theme toggle", () => {
    const nav = read("components/site/site-nav.tsx");
    const styles = read("app/globals.css");

    expect(nav).toContain("{!homepage && <ThemeToggle />}");
    expect(styles).toContain(".site-nav {");
    expect(styles).not.toContain(".site-nav.site-nav--home {");
    expect(styles).toContain("backdrop-filter: blur(24px) saturate(0.42)");
  });

  test("the globe loads only local geometry and never intercepts wheel events", () => {
    const globe = read("components/ui/wireframe-dotted-globe.tsx");
    const dots = JSON.parse(read("public/data/ne_110m_land_dots.json")) as unknown[];
    expect(globe).toContain('"/data/ne_110m_land.json"');
    expect(globe).toContain('"/data/ne_110m_land_dots.json"');
    expect(globe).not.toMatch(/https?:\/\//);
    expect(globe).not.toContain("makeLandDots");
    expect(dots).toHaveLength(3875);
    expect(globe).not.toContain('addEventListener("wheel"');
    expect(globe).not.toContain("context.ellipse");
    expect(globe).not.toContain("--globe-accent");
    expect(globe).toContain('addEventListener("pointercancel"');
    expect(globe).toContain("setPointerCapture");
    expect(globe).toContain("ResizeObserver");
    expect(globe).toContain("prefers-reduced-motion");
    expect(globe).toContain(".toFixed(4)");
    expect(globe).toContain(".toFixed(5)");
    expect(globe).toContain("overflow-visible rounded-full");
    expect(globe).not.toContain("overflow-hidden rounded-full");
  });

  test("the globe maps corpus coverage without navigating on selection", () => {
    const home = `${read("app/page.tsx")}\n${read("components/home/home-intro.tsx")}`;
    const selector = read("components/pilot/corpus-coverage-globe.tsx");
    const globe = read("components/ui/wireframe-dotted-globe.tsx");

    expect(home).toContain("<CorpusCoverageGlobe");
    expect(home).toContain("CORPUS_COVERAGE");

    // Selecting opens a panel; it does not leave the homepage. The panel's only
    // action is the Lab, and it carries the jurisdiction with it.
    expect(selector).toContain("Inspect in Lab");
    expect(selector).toContain("selected.labHref");
    expect(selector).not.toContain("router.push");
    for (const gone of ["Derived result", "Provisions considered", "Not yet traced", "/query"]) {
      expect(selector).not.toContain(gone);
    }

    // Hover and focus both raise the marker's label, and both carry the count.
    expect(globe).toContain("onPointerEnter");
    expect(globe).toContain("onFocus");
    expect(globe).toContain("marker.sublabel");
    expect(selector).toContain("corpusCountLabel");

    expect(globe).toContain("markerPausedRef.current");
    expect(globe).toContain("size-11");
    expect(selector).toContain("min-w-0 max-w-full");
    expect(selector).toContain("whitespace-normal");
    expect(selector).not.toContain("lg:absolute");
    expect(selector).not.toContain("min-[1400px]");
  });

  test("the coverage config claims only what has been reviewed", () => {
    const coverage = read("lib/corpus-coverage.ts");

    // Exactly the two jurisdictions with a reviewed corpus, the Union as one
    // entry rather than as member states, and no promise of anything else.
    expect(coverage).toContain('id: "eu"');
    expect(coverage).toContain('id: "us"');
    expect(coverage).toContain('name: "European Union"');
    expect(coverage).toContain('name: "United States"');
    expect(coverage.toLowerCase()).not.toContain("coming soon");
    for (const member of ["Germany", "France", "Ireland", "Netherlands"]) {
      expect(coverage).not.toContain(member);
    }

    // The globe connects to the Lab and to nothing else for now.
    expect(coverage).toContain("/lab?jurisdiction=eu");
    expect(coverage).toContain("/lab?jurisdiction=us");
    expect(coverage).not.toContain("/query");
    expect(coverage).not.toContain("/build");

    // …and the Lab honours that parameter rather than ignoring it.
    expect(read("app/lab/page.tsx")).toContain("params.jurisdiction");
    expect(read("components/lab/record-inspector.tsx")).toContain("initialJurisdiction");
  });

  test("the globe is the only member selector and is keyboard operable", () => {
    const selector = read("components/pilot/corpus-coverage-globe.tsx");
    const globe = read("components/ui/wireframe-dotted-globe.tsx");

    // The globe replaced the dropdown, so no control may duplicate it.
    expect(selector).not.toContain("<select");
    expect(selector).not.toContain("Choose a member");

    // The marker layer is a single composite tab stop over all members.
    expect(globe).toContain('role="listbox"');
    expect(globe).toContain('role="option"');
    expect(globe).toContain("aria-activedescendant");
    expect(globe).toContain("tabIndex={0}");

    // Arrow keys move the cursor, Home/End jump, Enter or Space opens.
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End", "Enter"]) {
      expect(globe).toContain(`"${key}"`);
    }

    // Reaching a member must turn the globe, otherwise the far side is a trap.
    expect(globe).toContain("rotateToRef.current?.(");
    expect(globe).toContain("function turnTo(");
    // Individual markers are never tab stops; the layer owns focus.
    expect(globe).toContain("markerElement.tabIndex = -1");
    // The cursor's marker is never hidden while aria-activedescendant names it.
    expect(globe).toContain("keyboardActive");
  });

  test("the Lab runs the pilot readings against the traced snapshots", () => {
    const toolchain = read("lib/toolchain.ts");
    const evaluate = read("app/api/evaluate/route.ts");
    const examples = read("app/api/examples/route.ts");

    // Every reading the Lab offers is a real file under the pilot.
    for (const file of [
      "model-evaluation-duty.writ",
      "any-actor-any-force.writ",
      "broad-conduct.writ",
      "incomplete-score.writ",
    ]) {
      expect(toolchain).toContain(file);
      expect(
        existsSync(
          resolve(
            WEB_ROOT,
            "../../archive/pilots/eu-us-ai-evaluation-v1/original/methodology",
            file,
          ),
        ),
      ).toBe(true);
    }
    expect(evaluate).toContain("evaluatePilot");
    expect(examples).toContain("loadPilotExamples");
    // The G7 member-specific Lab and its corpus adapter are gone rather than dangling.
    expect(existsSync(resolve(WEB_ROOT, "app/lab/page.tsx"))).toBe(true);
    expect(existsSync(resolve(WEB_ROOT, "components/g7"))).toBe(false);
    expect(existsSync(resolve(WEB_ROOT, "lib/g7-assessments.ts"))).toBe(false);
  });

  test("the workbench was demoted, not deleted", () => {
    const lab = read("app/lab/page.tsx");
    const technical = read("components/lab/technical-details.tsx");
    const workbench = read("components/lab/writ-lab.tsx");

    // Every panel is still there; it is reached through the disclosure instead
    // of being the first thing a reader meets.
    for (const panel of [
      "components/lab/writ-lab.tsx",
      "components/lab/writ-editor.tsx",
      "components/lab/analysis-panel.tsx",
      "components/lab/ir-panel.tsx",
      "components/lab/receipt-panel.tsx",
      "components/lab/evidence-panel.tsx",
      "components/lab/verdict.tsx",
    ]) {
      expect(existsSync(resolve(WEB_ROOT, panel))).toBe(true);
    }

    // The Lab page reaches the workbench only through Technical details.
    expect(lab).toContain("TechnicalDetails");
    expect(lab).not.toContain("WritLab");
    expect(technical).toContain("WritLab");

    // Collapsed by default, and its children mount only once it is opened —
    // the editor measures itself on mount and paints nothing while hidden.
    expect(technical).toContain("defaultOpen = false");
    expect(technical).toContain("everOpened");

    // The four rule-branch cards and the totality verdict live inside it, and
    // the two renamed tabs kept their values so nothing else had to change.
    expect(workbench).toContain('role="radiogroup"');
    expect(read("components/lab/verdict.tsx")).toContain("Total and non-overlapping");
    expect(workbench).toContain("Processing trace");
    expect(workbench).toContain("Retrieved records");
    expect(workbench).not.toContain(">Trace<");
    expect(workbench).not.toContain("100dvh");
  });

  test("the Lab leads with the passage, not the score program", () => {
    const inspector = read("components/lab/record-inspector.tsx");

    // Guided by default; Code available but never first.
    expect(read("app/lab/page.tsx")).toContain('params.view === "code" ? "code" : "guided"');
    expect(inspector).toContain("Source passage");
    expect(inspector).toContain("Structured record");

    // None of the retired vocabulary reaches the primary view.
    for (const retired of [
      "Total and non-overlapping",
      "score program",
      "input states",
      "unreachable",
    ]) {
      expect(inspector).not.toContain(retired);
      expect(read("components/lab/record-explanation.tsx")).not.toContain(retired);
      expect(read("lib/lab-explanation.ts")).not.toContain(retired);
    }
  });

  test("Build offers no publishing, contribution or local workflow", () => {
    // Comments are stripped: these files say in prose that they do none of
    // this, and that sentence must not read as an occurrence of it.
    const withoutComments = (path: string) =>
      read(path)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    const validate = withoutComments("components/build/steps/validate.tsx");
    const builder = withoutComments("components/build/builder.tsx");

    expect(validate).toContain("Save draft");
    expect(validate).toContain("Continue reviewing");
    expect(validate).toContain("View structured record");
    for (const forbidden of [
      "Publish",
      "Submit contribution",
      "pull request",
      "Open pull request",
      "Sync repository",
      "Export locally",
      "Download",
    ]) {
      expect(validate).not.toContain(forbidden);
      expect(builder).not.toContain(forbidden);
    }
  });

  test("changing a receipt input cannot relabel a stale receipt", () => {
    const receipt = read("components/lab/receipt-panel.tsx");
    expect(receipt).toContain("evaluatedMember !== member");
    expect(receipt).toContain("evaluatedProfile !== profile");
    expect(receipt).toContain("memberLabel(evaluatedMember ?? member)");
  });

  test("dark is the explicit default and system switching is disabled", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain('defaultTheme="dark"');
    expect(layout).toContain("enableSystem={false}");
  });

  test("the footer omits retired metadata and links to the Writ repository", () => {
    const footer = read("components/site/site-footer.tsx");
    const navItems = read("components/site/nav-items.ts");
    expect(footer).not.toContain("Deterministic · four-valued · content-hashed");
    expect(footer).not.toContain("reproduced 8 / 8");
    expect(footer).not.toContain("Archive");
    expect(footer).not.toContain("Documentation");
    expect(navItems).toContain("https://github.com/saykig/Writ");
  });

  test("the homepage motion has explicit reconstruction, scroll-progress and reduced-motion paths", () => {
    const home = read("app/page.tsx");
    const intro = read("components/home/home-intro.tsx");
    const network = read("components/home/corpus-network.tsx");
    const glyph = read("components/home/pixel-glyph.tsx");
    const field = read("components/home/homepage-field.tsx");
    const styles = read("app/globals.css");

    expect(home).toContain("<HomepageHero");
    expect(home).toContain("<CorpusNetwork");
    expect(home).toContain("<HomepageField");
    expect(home).not.toContain("<Reveal");
    expect(intro).toContain('from "motion/react"');
    expect(intro).toContain("useSpring");
    expect(intro).toContain("smoothGlobeProgress");
    expect(intro).toContain("smoothStatementProgress");
    expect(intro).not.toContain("getBoundingClientRect");
    expect(intro).not.toContain("introTitle.animate");
    expect(network).toContain("useScroll");
    expect(network).toContain("useSpring");
    expect(network).toContain("smoothProgress");
    expect(network).toContain("useTransform");
    expect(network).toContain("pathLength");
    expect(network).toContain("glyphCellPoint");
    expect(network).toContain("FEATURED_CORPORA");
    expect(network).toContain('label: "AI Act"');
    expect(network).toContain('label: "NIST"');
    expect(network).toContain('cellId: "U-07-15"');
    expect(network).not.toContain("corpus-prototype-family");
    expect(glyph).toContain("export function PixelGlyph");
    expect(glyph).toContain("export function PixelGlyphSilhouette");
    expect(glyph).toContain("data-cell-id");
    expect(glyph).toContain("interactiveCellIds.has(cell.id)");
    for (const letter of ["E", "U", "S", "C", "N", "I", "T"]) {
      expect(glyph).toContain(`export const ${letter}_GLYPH`);
    }
    expect(glyph).toContain("GeistPixel-Square.woff2");
    expect(field).toContain("useScroll");
    expect(field).toContain("useSpring");
    expect(field).toContain("smoothScrollProgress");
    expect(field).toContain("useTransform");
    expect(network).not.toContain("IntersectionObserver");
    expect(network).not.toContain("/lab?jurisdiction=");
    expect(network).toContain("View raw code?");
    expect(network).toContain("not a completeness estimate");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain(".home-motion-title");
    expect(styles).toContain(".corpus-prototype-stage");
    expect(styles).toContain("width: clamp(36rem, 62vw, 55rem)");
    expect(network).toContain("createPortal(");
    expect(styles).toContain(".pixel-corpus-hit-target");
    expect(styles).toContain(".pixel-corpus-silhouette-glow");
    expect(network).toContain("Click a lit block to explore the corpus.");
    expect(network).toContain("pixel-corpus-cell-halo");
    expect(network).toContain("onPointerEnter");
    expect(glyph).toContain('state === "hovered"');
    expect(styles).toContain("background: transparent");
    expect(styles).toContain(".raw-workspace");
  });
});
