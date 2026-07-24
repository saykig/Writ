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
        title="See how each result was reached."
        description="A receipt shows how Writ reached a result."
      />

      <section className="mx-auto max-w-[76rem] px-5 py-14 sm:px-6 sm:py-20">
        <div className="max-w-2xl rounded-xl border border-border bg-card p-7 sm:p-10">
          <ReceiptText className="size-7 text-primary" />
          <h2 className="mt-6 text-2xl font-semibold">No public receipts are available yet.</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Writ only publishes results that come from a defined methodology and reviewed evidence.
            You can explore the existing G7 example or create a receipt in the Playground.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              nativeButton={false}
              render={
                <Link href="/benchmark">
                  Open the G7 example
                  <ArrowRight />
                </Link>
              }
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/playground">Create a receipt in the Playground</Link>}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
