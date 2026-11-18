"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export function formatIsoDateForDisplay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function parseDisplayDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function DateInput({
  value,
  onChange,
  className,
  min,
  max,
  disabled,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "value"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const pickerRef = React.useRef<HTMLInputElement>(null);
  const display = draft ?? formatIsoDateForDisplay(value);

  const applyDisplayValue = (next: string) => {
    setDraft(next);
    if (!next.trim()) {
      onChange("");
      return;
    }
    const parsed = parseDisplayDate(next);
    if (parsed && (!min || parsed >= String(min)) && (!max || parsed <= String(max))) {
      onChange(parsed);
    }
  };

  return (
    <span className="relative block">
      <input
        {...props}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        autoComplete="off"
        disabled={disabled}
        value={display}
        onChange={(event) => applyDisplayValue(event.target.value)}
        onBlur={() => {
          const parsed = parseDisplayDate(display);
          if (
            parsed &&
            (!min || parsed >= String(min)) &&
            (!max || parsed <= String(max))
          ) {
            onChange(parsed);
          }
          setDraft(null);
        }}
        className={cn("pr-9", className)}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={`Open ${props["aria-label"] ?? "date"} calendar`}
        onClick={() => {
          const picker = pickerRef.current;
          if (!picker) return;
          if (typeof picker.showPicker === "function") picker.showPicker();
          else picker.click();
        }}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-[#6F6F6F] transition-colors hover:bg-[#F3F5F7] hover:text-[#111111] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#294D72] disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarDays className="size-3.5" aria-hidden="true" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={typeof min === "string" ? min : undefined}
        max={typeof max === "string" ? max : undefined}
        disabled={disabled}
        onChange={(event) => {
          setDraft(null);
          onChange(event.target.value);
        }}
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
      />
    </span>
  );
}
