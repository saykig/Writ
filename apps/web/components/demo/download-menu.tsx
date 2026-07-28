"use client";

/**
 * Two downloads, and the difference between them stated in the menu.
 *
 * The memo is the readable analysis; the profile is the structured material it
 * was produced from. Exporting the profile hands over the file the Playground
 * runs, not a simplified restatement of it, so a reader can check the memo
 * against the thing that made it.
 *
 * There is no PDF generator in this repository, so the memo exports as Markdown
 * and as a print view rather than through a dependency added for one button.
 */

import * as React from "react";
import { Download, FileText, Printer, Braces } from "lucide-react";

import type { Memo } from "@/lib/demo-memo";
import type { RepoProvenance } from "@/lib/repo-provenance";
import { memoFilename, memoToMarkdown } from "@/lib/demo-markdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function saveFile(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DownloadMenu({
  memo,
  provenance,
  profileSource,
  profileFilename,
}: {
  memo: Memo;
  provenance: RepoProvenance;
  /** The exact profile the memo was produced from, verbatim. */
  profileSource: string;
  profileFilename: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            <Download />
            Download
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-[19rem]">
        <DropdownMenuLabel className="text-[0.7rem] tracking-[0.1em] uppercase text-muted-foreground">
          Policy memo
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() =>
            saveFile(
              memoFilename(memo),
              memoToMarkdown({ memo, provenance, generatedAt: new Date().toISOString() }),
              "text/markdown;charset=utf-8",
            )
          }
        >
          <FileText />
          <span className="flex flex-col gap-0.5">
            <span>Download as Markdown</span>
            <span className="text-[0.72rem] text-muted-foreground">
              Readable analysis, with footnotes and sources.
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.print()}>
          <Printer />
          <span className="flex flex-col gap-0.5">
            <span>Print or save as PDF</span>
            <span className="text-[0.72rem] text-muted-foreground">
              Opens a print view with the footnotes expanded.
            </span>
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[0.7rem] tracking-[0.1em] uppercase text-muted-foreground">
          Writ profile
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => saveFile(profileFilename, profileSource, "text/plain;charset=utf-8")}
        >
          <Braces />
          <span className="flex flex-col gap-0.5">
            <span>Download the .writ profile</span>
            <span className="text-[0.72rem] text-muted-foreground">
              The structured claims and evidence used to produce the memo.
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
