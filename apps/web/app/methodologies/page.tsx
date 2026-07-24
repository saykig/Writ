import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Braces, FileCode2 } from "lucide-react";

import { analyze, loadExamples } from "@/lib/toolchain";
import { PageHeader } from "@/components/site/page-header";

export const metadata: Metadata = {
  title: "Methodologies · Writ",
  description:
    "Inspect the checked-in policy methodology sources, their structured readings, versions, and analyzer diagnostics.",
};

export default function MethodologiesPage() {
  const examples = loadExamples();

  return (
    <main>
      <PageHeader
        eyebrow="Methodologies"
        title="Inspect the original wording and every diagnostic before a result is produced."
        titleClassName="max-w-[26ch]"
      />

      <section className="mx-auto max-w-[76rem] px-5 py-14 sm:px-6 sm:py-20">
        <div className="grid gap-5 lg:grid-cols-3">
          {examples.map((example) => {
            const diagnostics = analyze(example.source).findings;
            return (
              <article key={example.id} className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between gap-4">
                  <FileCode2 className="size-5 text-primary" />
                  <span className="text-xs text-muted-foreground">{example.outcome}</span>
                </div>
                <h2 className="mt-6 text-xl font-semibold">{example.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{example.note}</p>
                <dl className="mt-6 divide-y divide-border border-y border-border text-sm">
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">Fixture ID</dt>
                    <dd className="font-mono text-xs">{example.id}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">Diagnostics</dt>
                    <dd>{diagnostics.length}</dd>
                  </div>
                </dl>
                <Link
                  href={`/playground?example=${example.id}` as Route}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Open this reading
                  <ArrowRight className="size-4" />
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex items-start gap-4 rounded-xl border border-border p-6 sm:p-8">
          <Braces className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">A second scoring shape</h2>
            <p className="mt-2 max-w-[68ch] text-sm leading-6 text-muted-foreground">
              The checked-in Gap Matrix demonstrates a weighted-ordinal methodology and preserves
              pending components as null rather than silently treating them as zero.
            </p>
            <Link
              href="/gap-matrix"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Inspect the Gap Matrix
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
