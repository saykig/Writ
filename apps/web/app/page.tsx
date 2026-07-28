import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { g7AssessmentPreviews } from "@/lib/g7-assessments";
import { G7GlobeSelector } from "@/components/g7/g7-globe-selector";
import { Reveal } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";

export default function Home() {
  const g7Members = g7AssessmentPreviews();

  return (
    <main>
      <Reveal as="section" className="min-h-[calc(100svh-4.5rem)]">
        <div className="mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-[76rem] items-center gap-4 px-5 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(30rem,1.12fr)] lg:py-8">
          <div className="relative z-10 py-4 lg:py-10">
            <h1 className="whitespace-nowrap text-[length:var(--t-hero)] leading-[0.98] font-semibold tracking-[-0.04em]">
              Write in Writ.
            </h1>
            <p className="mt-7 max-w-[36rem] text-[length:var(--t-lead)] leading-8 text-muted-foreground text-pretty">
              Writ is a Domain-Specific Language (DSL) for expressing rule-based policy evaluation
              methodologies over reviewed evidence and producing reproducible assessment receipts.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="text-[0.78rem] sm:text-[0.82rem]"
                nativeButton={false}
                render={
                  <Link href="/how-it-works">
                    See how it works
                    <ArrowRight />
                  </Link>
                }
              />
              <Button
                variant="outline"
                size="lg"
                nativeButton={false}
                render={<Link href="/playground">Try Writ</Link>}
              />
            </div>
          </div>

          <div className="mx-auto w-full min-w-0 max-w-[42rem] lg:justify-self-end">
            <G7GlobeSelector members={g7Members} />
          </div>
        </div>
      </Reveal>
    </main>
  );
}
