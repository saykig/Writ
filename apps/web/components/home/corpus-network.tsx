"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  CORPUS_CATALOG,
  CORPUS_CATALOG_SOURCE,
  type CatalogCorpusSummary,
} from "@/lib/corpus-catalog-data";

type MotionStyle = CSSProperties & Record<string, string | number | undefined>;

const CATALOG_BY_ID = new Map(CORPUS_CATALOG.map((corpus) => [corpus.corpusId, corpus]));

const FEATURED_GROUPS = [
  {
    family: "legal_policy" as const,
    glyph: "EU",
    jurisdiction: "EU",
    href: "/lab?jurisdiction=eu",
    records: [
      [
        "writ.corpus.legal-policy.eu.european-union.artificial-intelligence-act-2024-1689",
        "AI Act",
      ],
      ["writ.corpus.legal-policy.eu.european-commission.gpai-guidelines", "GPAI Guidelines"],
      [
        "writ.corpus.legal-policy.eu.european-commission.gpai-code-of-practice-signatory-notice",
        "Code of Practice notice",
      ],
    ],
  },
  {
    family: "legal_policy" as const,
    glyph: "US",
    jurisdiction: "US",
    href: "/lab?jurisdiction=us",
    records: [
      ["writ.corpus.legal-policy.us.nist.ai-risk-management-framework-1-0", "NIST RMF"],
      ["writ.corpus.legal-policy.us.nist.generative-ai-profile", "GenAI Profile"],
      ["writ.corpus.legal-policy.us.office-of-management-and-budget.m-25-21", "OMB M-25-21"],
      ["writ.corpus.legal-policy.us.white-house.americas-ai-action-plan", "AI Action Plan"],
    ],
  },
  {
    family: "institutional" as const,
    glyph: "EC",
    jurisdiction: "EU",
    records: [["eu.institutions.european_commission", "European Commission"]],
  },
  {
    family: "institutional" as const,
    glyph: "NIST",
    jurisdiction: "US",
    records: [["us.institutions.nist", "NIST"]],
  },
] as const;

function resolveCorpus(corpusId: string): CatalogCorpusSummary {
  const corpus = CATALOG_BY_ID.get(corpusId);
  if (!corpus) throw new Error(`${corpusId} is not present in ${CORPUS_CATALOG_SOURCE}`);
  return corpus;
}

function GlyphAnchor({ children, href }: { children: ReactNode; href?: Route }) {
  const className =
    "corpus-field-glyph focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return href ? (
    <Link href={href} className={className} aria-label={`Inspect ${children} corpora in the Lab`}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

function CorpusGlyphGroup({
  group,
  order,
}: {
  group: (typeof FEATURED_GROUPS)[number];
  order: number;
}) {
  const records = group.records.map(([corpusId, shortTitle]) => ({
    corpus: resolveCorpus(corpusId),
    shortTitle,
  }));
  const isDraft = records.every(({ corpus }) => corpus.status === "draft");

  return (
    <article
      className="corpus-field-group"
      data-glyph={group.glyph}
      data-status={isDraft ? "draft" : "active"}
      style={{ "--group-order": order } as MotionStyle}
    >
      <div className="corpus-field-glyph-wrap">
        <GlyphAnchor href={"href" in group ? group.href : undefined}>{group.glyph}</GlyphAnchor>
        <span className="corpus-field-jurisdiction">{group.jurisdiction}</span>
        {isDraft ? <span className="corpus-field-draft">draft</span> : null}
      </div>

      <ol className="corpus-field-records">
        {records.map(({ corpus, shortTitle }, recordIndex) => (
          <li
            className="corpus-field-record"
            key={corpus.corpusId}
            style={
              {
                "--record-index": recordIndex,
                "--line-span": `${(6.2 + ((recordIndex * 1.35 + order) % 3)).toFixed(2)}rem`,
              } as MotionStyle
            }
          >
            <span className="corpus-field-line" aria-hidden>
              <span />
            </span>
            <span className="corpus-field-record-title">{shortTitle}</span>
            <span className="corpus-field-record-meta">
              {corpus.issuer}
              {corpus.status === "draft" ? " · draft" : ""}
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}

export function CorpusNetwork() {
  const legalGroups = FEATURED_GROUPS.filter((group) => group.family === "legal_policy");
  const institutionalGroups = FEATURED_GROUPS.filter((group) => group.family === "institutional");

  return (
    <section className="corpus-field" aria-labelledby="corpus-field-title">
      <div className="mx-auto max-w-[76rem] px-5 py-24 sm:px-6 sm:py-32">
        <h2 id="corpus-field-title" className="sr-only">
          Native Writ corpus families
        </h2>

        <CorpusFamilyBlock label="legal_policy" groups={legalGroups} />
        <CorpusFamilyBlock label="institutional" groups={institutionalGroups} />

        <div className="corpus-field-footer">
          <p>
            Native corpus identities and statuses are projected from{" "}
            <code>{CORPUS_CATALOG_SOURCE}</code>.
          </p>
          <Link href="/lab" className="corpus-field-lab-link">
            Open Lab <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

function CorpusFamilyBlock({
  label,
  groups,
}: {
  label: "legal_policy" | "institutional";
  groups: (typeof FEATURED_GROUPS)[number][];
}) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const block = blockRef.current;
    if (!block) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "-12% 0px -10%", threshold: 0.12 },
    );
    observer.observe(block);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={blockRef} className="corpus-family-block" data-visible={visible ? "true" : "false"}>
      <p className="corpus-family-label">{label}</p>
      <div
        className={`corpus-family-groups corpus-family-groups--${label === "legal_policy" ? "legal" : "institutional"}`}
      >
        {groups.map((group, index) => (
          <CorpusGlyphGroup key={group.glyph} group={group} order={index} />
        ))}
      </div>
    </div>
  );
}
