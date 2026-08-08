/**
 * THESIS: Writ is understood by following one fact, not by learning its internals.
 * OWN-WORLD: The existing near-black research instrument, hairlines, restrained blue,
 * and precise document typography; no new visual language or ornamental illustration.
 * STORY: One NIST source becomes an exact passage, one reviewed placement record, a
 * corpus question, and an answer whose trace returns to the original words.
 * FIRST VIEWPORT: A compact statement and six-stage route map make the whole mechanism
 * legible before the visitor scrolls; the Lab action closes the walkthrough.
 * FORM: The approved continuous evidence thread, first-ranked for comprehension, with
 * a sticky desktop rail and complete linear mobile/reduced-motion reading.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { StartHereWalkthrough } from "@/components/start-here/start-here-walkthrough";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Start Here · Writ",
  description:
    "See how Writ turns one exact source passage into a reviewed fact and a traceable answer.",
};

export default function StartHerePage() {
  return (
    <main className="flex-1">
      <article className="mx-auto w-[min(100%-2.5rem,76rem)] pt-12 pb-24 sm:pt-16 sm:pb-28">
        <header className="max-w-[46rem]">
          <p className="label">Start Here</p>
          <h1 className="mt-4 max-w-[13ch] text-[length:var(--t-page)] leading-[0.98] tracking-[-0.03em]">
            From source to answer.
          </h1>
          <p className="mt-6 max-w-[43rem] text-[length:var(--t-lead)] leading-8 text-muted-foreground text-pretty">
            Writ turns documents into small, reviewable pieces of knowledge — and keeps every answer
            connected to the evidence it came from.
          </p>
        </header>

        <StartHereWalkthrough />

        <section
          aria-labelledby="start-here-next"
          className="mt-24 border-t border-border pt-14 sm:mt-32 sm:pt-18"
        >
          <div className="max-w-[42rem]">
            <h2
              id="start-here-next"
              className="text-[length:var(--t-h2)] leading-[1.08] tracking-[-0.025em]"
            >
              You have seen how one passage becomes one traceable answer.
            </h2>
            <div className="mt-7 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <Button
                size="lg"
                nativeButton={false}
                render={
                  <Link href="/lab">
                    Explore in Writ Lab
                    <ArrowRight aria-hidden data-icon="inline-end" />
                  </Link>
                }
              />
              <Link
                href="/how-it-works"
                className="text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
              >
                Want the technical explanation? Read How it works →
              </Link>
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
