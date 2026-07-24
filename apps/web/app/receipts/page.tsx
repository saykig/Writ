import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/page-header";

export const metadata: Metadata = {
  title: "Receipts · Writ",
  description:
    "Inspect the rule, evidence, interpretation, source, and version behind an assessment result.",
};

export default function ReceiptsPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Receipts"
        title="See how each assessment was reached."
        description="A receipt lets a policy researcher trace a result back to the matched rule, reviewed evidence, interpretation profile, and frozen source version."
      />

      <section className="mx-auto max-w-[76rem] px-5 py-14 sm:px-6 sm:py-20">
        <div className="max-w-2xl rounded-xl border border-border bg-card p-7 sm:p-10">
          <ReceiptText className="size-7 text-primary" />
          <h2 className="mt-6 text-2xl font-semibold">
            No corpus receipts are published here yet.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Writ does not fabricate normalized assessments. The existing frozen G7 fixture remains
            available in the benchmark, and the Playground can generate a receipt from an explicit
            methodology and evidence snapshot.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              nativeButton={false}
              render={
                <Link href="/benchmark">
                  Open the G7 benchmark
                  <ArrowRight />
                </Link>
              }
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/playground">Generate a Playground receipt</Link>}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
