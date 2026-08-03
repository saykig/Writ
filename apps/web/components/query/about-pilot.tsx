"use client";

/**
 * What this pilot is, for someone who has never heard of a domain-specific
 * language. Deliberately short: the point is that selecting a question does not
 * start a search, it renders reviewed records.
 */

import * as React from "react";
import { Info } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AboutPilot({ question }: { question: string }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="About this pilot"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 align-middle text-[0.72rem] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Info aria-hidden className="size-3.5" />
            About this pilot
          </button>
        }
      />
      <DialogContent className="max-w-[34rem]">
        <DialogHeader>
          <DialogTitle>About this pilot</DialogTitle>
          <DialogDescription className="sr-only">
            What the reviewed pilot covers and how the memos are produced.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-[0.88rem] leading-7 text-muted-foreground">
          <p>
            This is Writ’s first human-reviewed pilot. It uses a limited set of reviewed European
            Union and United States policy sources organised around one main question:
          </p>
          <p className="border-l border-border pl-4 text-foreground">{question}</p>
          <p>
            Writ organises the reviewed material into a consistent structure: who a rule applies to,
            what it requires, how legally strong it is, and whether it currently applies.
          </p>
          <p>
            Selecting a question does not begin a new open-ended search. It uses the same reviewed
            records to assemble a readable answer. Every judgment and citation can be traced to its
            source and underlying Writ profile.
          </p>
          <p className="text-foreground">
            Query answers from this corpus. Lab shows how one passage in it became one record.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
