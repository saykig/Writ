"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { TruthBadge } from "@/components/site/truth-badge";
import type { Proof, ProofNode, Truth } from "./types";

const TRUTH_VALUES: Truth[] = ["true", "false", "unknown", "contested"];

function truthBadgeValue(truth: Truth | undefined) {
  return truth && TRUTH_VALUES.includes(truth) ? truth : "unknown";
}

/** Render a proof node's `value` compactly for display. */
function formatValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface NodeProps {
  node: ProofNode;
  byId: Map<string, ProofNode>;
  depth: number;
  ancestors: ReadonlySet<string>;
}

function TreeNode({ node, byId, depth, ancestors }: NodeProps) {
  // Collapse anything past the second level by default; deep proofs stay legible.
  const [open, setOpen] = useState(depth < 2);

  const children = node.child_ids
    .filter((id) => byId.has(id) && !ancestors.has(id))
    .map((id) => byId.get(id)!);
  const hasChildren = children.length > 0;
  const value = formatValue(node.value);
  const nextAncestors = new Set(ancestors).add(node.id);

  return (
    <div className="relative">
      <div
        className={cn(
          "group flex items-baseline gap-2 rounded-[3px] py-1 pr-2 pl-1",
          "hover:bg-surface-2/50",
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Collapse" : "Expand"}
            className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[2px] text-ink-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/60"
          >
            <ChevronRight
              className={cn(
                "size-3 transition-transform motion-reduce:transition-none",
                open && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span aria-hidden className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
            <span className="size-1 rounded-full bg-ink-faint/40" />
          </span>
        )}

        <TruthBadge value={truthBadgeValue(node.truth_value)} className="mt-0.5 shrink-0" />

        <span className="min-w-0 font-mono text-[0.72rem] leading-relaxed">
          <span className="text-ink-faint">{node.kind}</span>
          <span className="mx-1 text-ink-faint/50">·</span>
          <span className="text-foreground/90">{node.label || "—"}</span>
          {value !== null ? <span className="text-gold"> = {value}</span> : null}
        </span>
      </div>

      {hasChildren && open ? (
        <div className="ml-2 border-l border-border/70 pl-2">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              byId={byId}
              depth={depth + 1}
              ancestors={nextAncestors}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * ProofTree — renders `proof.nodes` as a collapsible tree walked from `root_id`
 * along `child_ids`. Truth values are colored by the shared TruthBadge; a node's
 * kind, label, and value are shown inline. Nodes past depth 2 start collapsed.
 */
export function ProofTree({ proof }: { proof: Proof }) {
  const byId = new Map(proof.nodes.map((node) => [node.id, node]));
  const root = byId.get(proof.root_id);

  if (!root) {
    return <p className="text-sm text-ink-soft">No proof root found.</p>;
  }

  return (
    <div className="font-mono">
      <TreeNode node={root} byId={byId} depth={0} ancestors={new Set()} />
    </div>
  );
}
