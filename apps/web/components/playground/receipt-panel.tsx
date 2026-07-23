"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, ScrollText, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { EvaluationReceipt } from "@covenant/domain";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HashPill } from "@/components/site/hash-pill";
import { TruthBadge } from "@/components/site/truth-badge";
import { Disclosure } from "./disclosure";
import { ProofTree } from "./proof-tree";
import {
  badgeResult,
  MEMBER_LABELS,
  MEMBERS,
  PROFILE_LABELS,
  type EvaluateResponse,
  type Member,
  type Profile,
  type VerifyResponse,
} from "./types";

const RESULT_STATUS_TONE: Record<string, string> = {
  supported: "border-true/35 bg-true/10 text-true",
  contested: "border-gold/45 bg-gold-wash text-gold",
  incomplete: "border-unknown/40 bg-unknown/10 text-unknown",
  ambiguous: "border-gold/45 bg-gold-wash text-gold",
  invalid: "border-false/35 bg-false/10 text-false",
};

/** Flip a receipt result to a different value — the tamper demonstration. */
function flipResult(result: string): string {
  switch (result) {
    case "+1":
      return "-1";
    case "-1":
      return "+1";
    case "0":
      return "+1";
    case "unresolved":
      return "0";
    default:
      return "0";
  }
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
      {children}
    </span>
  );
}

function HashRow({ label, hash, emphasize }: { label: string; hash: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span
        className={cn(
          "font-mono text-[0.72rem]",
          emphasize ? "font-medium text-foreground" : "text-ink-faint",
        )}
      >
        {label}
      </span>
      <HashPill hash={hash} chars={10} />
    </div>
  );
}

export interface ReceiptPanelProps {
  source: string;
  canEvaluate: boolean;
}

/**
 * ReceiptPanel — evaluate the current methodology against a member snapshot and
 * profile, then read the receipt result first: the score, the matched rule, and
 * a verify/tamper affordance. The heavier evidence (rule evaluations, the proof
 * tree, the dependency hashes) sits behind disclosures, opened on demand.
 */
export function ReceiptPanel({ source, canEvaluate }: ReceiptPanelProps) {
  const [member, setMember] = useState<Member>("japan");
  const [profile, setProfile] = useState<Profile>("published");
  const [receipt, setReceipt] = useState<EvaluationReceipt | null>(null);
  const [evaluatedSource, setEvaluatedSource] = useState<string | null>(null);
  const [evaluatedProfile, setEvaluatedProfile] = useState<string>("published");
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const [tampered, setTampered] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [verifying, setVerifying] = useState(false);

  // A receipt is only valid for the source it was produced from; a later edit
  // makes it stale rather than resetting state from an effect.
  const stale = receipt !== null && evaluatedSource !== source;
  const shownReceipt = stale ? null : receipt;

  const runVerify = useCallback(async (toVerify: EvaluationReceipt, notify: boolean) => {
    setVerifying(true);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receipt: toVerify }),
      });
      const data = (await res.json()) as VerifyResponse;
      setVerifyResult(data);
      if (notify) {
        if (data.valid) {
          toast.success("Receipt verified", { description: "Recomputed hash matches." });
        } else {
          toast.error("Hash mismatch", { description: "The receipt does not match its hash." });
        }
      }
      return data;
    } catch {
      if (notify) toast.error("Verification failed");
      return null;
    } finally {
      setVerifying(false);
    }
  }, []);

  async function handleEvaluate() {
    setEvaluating(true);
    setEvalError(null);
    setVerifyResult(null);
    setTampered(false);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, member, profile }),
      });
      const data = (await res.json()) as EvaluateResponse;
      if (data.ok && data.receipt) {
        setReceipt(data.receipt);
        setEvaluatedSource(source);
        setEvaluatedProfile(data.profile ?? profile);
      } else {
        setReceipt(null);
        setEvaluatedSource(null);
        setEvalError(data.error ?? "Evaluation failed.");
      }
    } catch {
      setEvalError("Could not reach the evaluator.");
    } finally {
      setEvaluating(false);
    }
  }

  function tamperedCopy(base: EvaluationReceipt): EvaluationReceipt {
    return { ...base, result: flipResult(base.result) as EvaluationReceipt["result"] };
  }

  async function handleVerify() {
    if (!receipt) return;
    await runVerify(tampered ? tamperedCopy(receipt) : receipt, true);
  }

  async function handleToggleTamper() {
    if (!receipt) return;
    const next = !tampered;
    setTampered(next);
    await runVerify(next ? tamperedCopy(receipt) : receipt, false);
  }

  const dependencies = shownReceipt?.dependencies;
  const qualifying = shownReceipt?.qualifying_action_ids ?? [];
  const allActions = dependencies?.action_ids ?? [];
  const qualifyingSet = new Set(qualifying);
  const excluded = allActions.filter((id) => !qualifyingSet.has(id));

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <FieldLabel>Member</FieldLabel>
          <Select value={member} onValueChange={(value) => setMember(value as Member)}>
            <SelectTrigger className="w-44" aria-label="Member">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEMBERS.map((id) => (
                <SelectItem key={id} value={id}>
                  {MEMBER_LABELS[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1.5">
          <FieldLabel>Profile</FieldLabel>
          <Select value={profile} onValueChange={(value) => setProfile(value as Profile)}>
            <SelectTrigger className="w-36" aria-label="Interpretation profile">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROFILE_LABELS) as Profile[]).map((id) => (
                <SelectItem key={id} value={id}>
                  {PROFILE_LABELS[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <Button onClick={handleEvaluate} disabled={!canEvaluate || evaluating}>
          <ScrollText />
          {evaluating ? "Evaluating…" : "Evaluate"}
        </Button>
      </div>

      {!canEvaluate ? (
        <p className="text-[0.9rem] text-ink-soft">
          The source must compile before it can be evaluated. Resolve the diagnostics first.
        </p>
      ) : null}

      {evalError ? (
        <div className="rounded-lg border border-false/30 bg-false/[0.05] px-3.5 py-2.5 text-[0.9rem] text-false">
          {evalError}
        </div>
      ) : null}

      {shownReceipt ? (
        <div className="space-y-5">
          {/* Result head */}
          <div className="flex items-start gap-3 border-b border-rule pb-5">
            <TruthBadge value={badgeResult(shownReceipt.result)} className="px-2 py-1 text-sm">
              {shownReceipt.result}
            </TruthBadge>
            <div className="min-w-0 space-y-1.5 text-[0.9rem]">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <strong className="font-medium text-foreground">{MEMBER_LABELS[member]}</strong>
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.68rem]",
                    RESULT_STATUS_TONE[shownReceipt.result_status] ?? "border-rule text-ink-soft",
                  )}
                >
                  {shownReceipt.result_status}
                </span>
                <span className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
                  {evaluatedProfile}
                </span>
              </div>
              <p className="text-ink-soft">
                matched rule{" "}
                <span className="font-mono text-[0.82rem] text-foreground">
                  {shownReceipt.matched_rule_id ?? "—"}
                </span>{" "}
                · {qualifying.length} qualifying · {shownReceipt.proof.nodes.length} proof nodes
              </p>
            </div>
          </div>

          {/* Detail, on demand */}
          <div>
            <Disclosure
              summary="Rule evaluations & actions"
              meta={`${shownReceipt.rule_evaluations.length} rules`}
            >
              <div className="overflow-hidden rounded-lg border border-rule">
                {shownReceipt.rule_evaluations.map((evaluation) => (
                  <div
                    key={evaluation.rule_id}
                    className="flex items-center gap-3 border-b border-rule/60 px-3 py-2 font-mono text-[0.72rem] last:border-b-0"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        evaluation.truth_value === "true" ? "bg-true" : "bg-ink-faint/40",
                      )}
                    />
                    <span className="text-foreground/90">{evaluation.rule_id}</span>
                    <span className="text-ink-faint tabular-nums">p{evaluation.priority}</span>
                    <TruthBadge value={badgeResult(evaluation.result)} className="ml-auto" />
                    <TruthBadge value={evaluation.truth_value} />
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div>
                  <FieldLabel>Qualifying · {qualifying.length}</FieldLabel>
                  <ul className="mt-2 space-y-1">
                    {qualifying.map((id) => (
                      <li
                        key={id}
                        className="flex items-baseline gap-2 font-mono text-[0.72rem] text-ink-soft"
                      >
                        <CheckCircle2
                          className="size-3 shrink-0 translate-y-0.5 text-true"
                          aria-hidden
                        />
                        <span className="break-all">{id}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <FieldLabel>Excluded · {excluded.length}</FieldLabel>
                  {excluded.length ? (
                    <ul className="mt-2 space-y-1">
                      {excluded.map((id) => (
                        <li
                          key={id}
                          className="flex items-baseline gap-2 font-mono text-[0.72rem] text-ink-faint"
                        >
                          <span aria-hidden className="translate-y-1 text-ink-faint">
                            –
                          </span>
                          <span className="break-all">{id}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[0.78rem] text-ink-faint">
                      None. Every governed action qualified.
                    </p>
                  )}
                </div>
              </div>
            </Disclosure>

            <Disclosure summary="Proof" meta={`${shownReceipt.proof.nodes.length} nodes`}>
              <div className="max-h-[360px] overflow-auto rounded-lg border border-rule bg-paper-deep/20 p-2">
                <ProofTree proof={shownReceipt.proof} />
              </div>
            </Disclosure>

            {dependencies ? (
              <Disclosure summary="Content hashes" meta="5">
                <div className="rounded-lg border border-rule bg-paper-deep/30 px-3.5 py-1.5">
                  <HashRow
                    label="methodology_bundle_hash"
                    hash={dependencies.methodology_bundle_hash}
                  />
                  <HashRow
                    label="evidence_snapshot_hash"
                    hash={dependencies.evidence_snapshot_hash}
                  />
                  <HashRow
                    label="interpretation_profile_hash"
                    hash={dependencies.interpretation_profile_hash}
                  />
                  <HashRow label="evaluator_build_hash" hash={dependencies.evaluator_build_hash} />
                  <div className="my-1 h-px bg-rule/60" />
                  <HashRow label="canonical_hash" hash={shownReceipt.canonical_hash} emphasize />
                </div>
              </Disclosure>
            ) : null}
          </div>

          {/* Verify + tamper */}
          <div className="rounded-lg border border-rule bg-paper-deep/30 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={handleVerify} disabled={verifying}>
                <ShieldCheck />
                {verifying ? "Verifying…" : "Verify"}
              </Button>
              <button
                type="button"
                role="switch"
                aria-checked={tampered}
                onClick={handleToggleTamper}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[0.8rem] transition-colors focus-visible:outline-none",
                  tampered
                    ? "border-false/40 bg-false/10 text-false"
                    : "border-rule text-ink-soft hover:border-rule-strong hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn("size-1.5 rounded-full", tampered ? "bg-false" : "bg-ink-faint/50")}
                />
                Tamper: flip result
              </button>
            </div>

            {tampered ? (
              <p className="mt-3 flex items-start gap-1.5 text-[0.8rem] text-false">
                <ShieldAlert className="size-3.5 shrink-0 translate-y-0.5" aria-hidden />
                <span>
                  The <span className="font-mono">result</span> field is now{" "}
                  <span className="font-mono">{flipResult(shownReceipt.result)}</span>, so the
                  receipt no longer matches its own hash.
                </span>
              </p>
            ) : null}

            {verifyResult ? (
              <div className="mt-3 space-y-2">
                <div
                  className={cn(
                    "flex items-center gap-2 text-[0.9rem]",
                    verifyResult.valid ? "text-true" : "text-false",
                  )}
                >
                  {verifyResult.valid ? (
                    <ShieldCheck className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <ShieldAlert className="size-4 shrink-0" aria-hidden />
                  )}
                  <span>
                    {verifyResult.valid
                      ? "Valid. The recomputed hash matches the receipt."
                      : "Invalid. The recomputed hash does not match."}
                  </span>
                </div>
                <div className="space-y-1 rounded-lg border border-rule bg-background/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[0.72rem] text-ink-faint">expected</span>
                    <HashPill hash={verifyResult.expected} chars={12} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[0.72rem] text-ink-faint">actual</span>
                    <HashPill hash={verifyResult.actual} chars={12} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : stale ? (
        <p className="rounded-lg border border-rule bg-paper-deep/30 px-3.5 py-2.5 text-[0.9rem] text-ink-soft">
          The source changed since the last receipt. Evaluate again to produce a fresh one.
        </p>
      ) : !evalError && canEvaluate ? (
        <p className="text-[0.9rem] text-ink-soft">
          Choose a member and profile, then evaluate to produce a receipt with its proof tree.
        </p>
      ) : null}
    </div>
  );
}
