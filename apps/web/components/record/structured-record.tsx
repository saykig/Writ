/**
 * The record's fields, in readable form.
 *
 * Every field the reviewers recorded appears, in the guided order first and the
 * record's own order after it. Nothing is dropped: a field hidden here would be
 * read as a field the reviewers never filled in, which is a different claim.
 *
 * `unknown` is a recorded judgment and takes the reserved colour. A field the
 * reviewers left empty is not shown at all — absence and unknown are not the
 * same, and neither is a failure.
 */

import type { LabRecordField, RecordFieldKey } from "@/lib/record-view";
import { cn } from "@/lib/utils";

const GROUP_LABELS: Record<string, string> = {
  identity: "Record",
  actor: "Actor",
  conduct: "Claim or conduct",
  conditions: "Conditions",
  force: "Legal force",
  lifecycle: "Lifecycle",
  authority: "Authority",
  other: "Also recorded",
};

export function StructuredRecord({
  fields,
  activeField = null,
  onFieldHover,
  className,
}: {
  fields: readonly LabRecordField[];
  activeField?: RecordFieldKey | null;
  onFieldHover?: (key: RecordFieldKey | null) => void;
  className?: string;
}) {
  const groups: { group: string; fields: LabRecordField[] }[] = [];
  for (const field of fields) {
    const last = groups[groups.length - 1];
    if (last && last.group === field.group) last.fields.push(field);
    else groups.push({ group: field.group, fields: [field] });
  }

  return (
    <div className={cn("space-y-4", className)}>
      {groups.map((group, index) => (
        <section key={`${group.group}-${index}`}>
          <h4 className="text-[0.62rem] tracking-[0.12em] uppercase text-muted-foreground">
            {GROUP_LABELS[group.group] ?? group.group}
          </h4>
          <dl className="mt-1.5">
            {group.fields.map((field) => (
              <div
                key={field.key}
                data-field={field.key}
                onMouseEnter={onFieldHover ? () => onFieldHover(field.key) : undefined}
                onMouseLeave={onFieldHover ? () => onFieldHover(null) : undefined}
                className={cn(
                  "flex items-baseline justify-between gap-4 rounded-[3px] border-b border-border/50 px-1 py-1.5 transition-colors last:border-b-0 motion-reduce:transition-none",
                  activeField === field.key && "bg-gold-wash",
                )}
              >
                <dt className="shrink-0 text-[0.72rem] text-muted-foreground">{field.label}</dt>
                <dd
                  className={cn(
                    "min-w-0 text-right text-[0.78rem] leading-6",
                    field.isUnknown ? "text-unknown" : "text-foreground",
                  )}
                >
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
