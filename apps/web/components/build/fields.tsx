"use client";

/**
 * The form atoms the Builder is made of.
 *
 * Label above, control below, an optional line of help under that. No asterisks
 * and no required marks: a field a reviewer cannot answer should be left empty
 * and reported as not recorded, which is what the validation step is for.
 */

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { humanize } from "@/lib/demo-analysis-format";
import { cn } from "@/lib/utils";

export function Field({
  label,
  help,
  htmlFor,
  children,
  className,
}: {
  label: string;
  help?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[0.72rem] tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {help ? <p className="text-[0.72rem] leading-6 text-muted-foreground">{help}</p> : null}
    </div>
  );
}

export function TextField({
  label,
  help,
  value,
  onChange,
  placeholder,
  type = "text",
  className,
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  const id = React.useId();
  return (
    <Field label={label} help={help} htmlFor={id} className={className}>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  help,
  value,
  onChange,
  placeholder,
  rows = 4,
  className,
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const id = React.useId();
  return (
    <Field label={label} help={help} htmlFor={id} className={className}>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

/**
 * A coded field. Options come from the reviewed corpus, and the empty option is
 * offered first because leaving a field unrecorded is a legitimate answer.
 */
export function SelectField({
  label,
  help,
  value,
  options,
  onChange,
  placeholder = "Not recorded",
  allowEmpty = true,
  className,
}: {
  label: string;
  help?: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** False where the field always holds a value, so no clearing option is offered. */
  allowEmpty?: boolean;
  className?: string;
}) {
  return (
    <Field label={label} help={help} className={className}>
      <Select
        value={value || "__none"}
        onValueChange={(next) => onChange(next === "__none" ? "" : String(next))}
      >
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue>
            {value ? (
              <span className={value === "unknown" ? "text-unknown" : undefined}>
                {humanize(value)}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? <SelectItem value="__none">{placeholder}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {humanize(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
