import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";

/**
 * PagePlaceholder — a tasteful "in progress" page that still lives inside the
 * shell, so every nav route resolves while its full build lands. Lists the
 * planned contents so the route reads as intentional, not missing.
 */
export function PagePlaceholder({
  eyebrow,
  title,
  description,
  planned,
}: {
  eyebrow: string;
  title: string;
  description: string;
  planned?: readonly string[];
}) {
  return (
    <main className="mx-auto w-full max-w-[76rem] flex-1 px-5 py-20 sm:px-6 sm:py-28">
      <div className="max-w-2xl">
        <SectionLabel seam className="mb-5">
          {eyebrow} · in progress
        </SectionLabel>
        <SectionHeading as="h1" className="text-4xl sm:text-5xl">
          {title}
        </SectionHeading>
        <Prose className="mt-5">{description}</Prose>

        {planned && planned.length > 0 ? (
          <div className="mt-10 border-t border-border pt-6">
            <p className="label-mono mb-4">What this page will hold</p>
            <ul className="flex flex-col gap-3">
              {planned.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-ink-soft">
                  <span aria-hidden className="mt-[0.45rem] h-px w-4 shrink-0 bg-gold" />
                  <span className="[text-wrap:pretty]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link href="/playground">
                Open the playground
                <ArrowRight />
              </Link>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/">Back to overview</Link>}
          />
        </div>
      </div>
    </main>
  );
}
