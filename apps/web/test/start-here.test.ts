import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB_ROOT = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(WEB_ROOT, path), "utf8");

describe("Start Here system walkthrough", () => {
  test("is the first primary destination and owns the full explanation", () => {
    const nav = read("components/site/nav-items.ts");
    const startHere = nav.indexOf('label: "Start Here"');

    expect(startHere).toBeGreaterThan(-1);
    for (const label of ["Corpus", "Build", "Lab"]) {
      expect(startHere).toBeLessThan(nav.indexOf(`label: "${label}"`));
    }
    expect(nav).not.toContain('label: "How it works"');
    expect(read("app/how-it-works/page.tsx")).toContain('redirect("/start-here")');
  });

  test("renders the explicit five-state ingestion model", () => {
    expect(existsSync(resolve(WEB_ROOT, "app/start-here/page.tsx"))).toBe(true);
    const story = read("components/how-it-works/story-types.ts");

    for (const stage of ["source", "passage", "record", "review", "corpus"]) {
      expect(story).toContain(`"${stage}"`);
    }
    expect(story).not.toContain('"query"');
    expect(story).not.toContain('"result"');
  });

  test("carries the reviewed NIST Stage A example through one persistent canvas", () => {
    const story = read("components/how-it-works/how-it-works-story.tsx");
    const canvas = read("components/how-it-works/writ-system-canvas.tsx");
    const implementation = `${story}\n${canvas}`;

    expect(story).toContain("<WritSystemCanvas activeStage={activeStage}");
    expect(canvas).toContain("National Institute of Standards and Technology");
    expect(canvas).toContain("U.S. Department of Commerce");
    expect(canvas).toContain("PROPOSED RECORD");
    expect(canvas).toContain("HUMAN REVIEW");
    expect(canvas).toContain("judgment accepted");
    expect(canvas).toContain("NIST institutional corpus");
    expect(canvas).not.toContain("hiw-query-object");
    expect(canvas).not.toContain("hiw-result-object");
    expect(implementation).toContain("legal_policy");
    expect(implementation).toContain("institutional");
  });

  test("explains atomicity, provenance, proposal boundaries, and missing evidence", () => {
    const story = read("components/how-it-works/how-it-works-story.tsx");

    expect(story).toContain("One record, one supported fact.");
    expect(story).toContain("Models may propose. People decide.");
    expect(story).toContain(
      "Once a corpus exists, it can be searched, compared or queried without losing the evidence underneath it.",
    );
    expect(story).toContain("Missing evidence");
    expect(story).toContain("is not automatically false.");
    expect(story).toContain('href="/lab"');
  });

  test("provides five-stage scroll state, mobile and reduced-motion paths", () => {
    const story = read("components/how-it-works/how-it-works-story.tsx");
    const canvas = read("components/how-it-works/writ-system-canvas.tsx");
    const styles = read("app/globals.css");

    expect(story).toContain("useScroll");
    expect(story).toContain("useMotionValueEvent");
    expect(story).toContain('aria-current={index === activeIndex ? "step"');
    expect(canvas).toContain("/ 05");
    expect(styles).toContain("min-height: 82svh");
    expect(styles).not.toContain("height: 12rem");
    expect(styles).toContain(".hiw-mobile-canvas");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  test("presents the technical foundations as a plain, single-open disclosure list", () => {
    const story = read("components/how-it-works/how-it-works-story.tsx");
    const styles = read("app/globals.css");
    const knowledgeModel = story.indexOf('title: "Knowledge model"');
    const writLanguage = story.indexOf('title: ".writ"');

    expect(knowledgeModel).toBeGreaterThan(-1);
    expect(knowledgeModel).toBeLessThan(writLanguage);
    for (const topic of [
      "Knowledge model",
      "Evidence and provenance",
      "Corpus families",
      ".writ",
      "Schemas",
      "Parser and compiler",
      "Fingerprints",
      "Conformance",
    ]) {
      expect(story).toContain(topic);
    }
    expect(story).toContain("Technical foundations");
    expect(story).toContain("The parts underneath Writ, if you want to see how it actually works.");
    expect(story).toContain("setOpenFoundation");
    expect(story).toContain("aria-expanded={isOpen}");
    expect(story).toContain("nist_organizational_placement : institutional");
    expect(styles).toContain(".hiw-foundation-panel");
    expect(story).not.toContain("Technical details");
    expect(styles).not.toContain(".hiw-technical-grid");
  });

  test("does not restore the retired product model or unfinished Stage B data", () => {
    const page = read("app/start-here/page.tsx");
    const story = read("components/how-it-works/how-it-works-story.tsx");
    const canvas = read("components/how-it-works/writ-system-canvas.tsx");
    const implementation = `${page}\n${story}\n${canvas}`;

    for (const forbidden of [
      "2025 G7 AI-for-SMEs",
      "G20 Rio",
      "Gap Matrix",
      "canonical IR",
      "bearer token",
      "methodology_bundle_hash",
      "nist_mandate",
      "operational_capacity",
      "european_commission",
    ]) {
      expect(implementation).not.toContain(forbidden);
    }
  });
});
