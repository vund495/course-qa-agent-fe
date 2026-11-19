"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorViewProps {
  error: Error & { digest?: string };
  reset?: () => void;
  title?: string;
  message?: string;
  homeHref?: string;
  homeLabel?: string;
  className?: string;
}

/**
 * Human-friendly error screen for students, teachers, and admins.
 * Designed without technical jargon or coder references.
 * Logs error details strictly to console.error (AC-05).
 */
export function ErrorView({
  error,
  reset,
  title = "We couldn't load this page",
  message = "A temporary connection issue interrupted this page. Don't worry, your progress and data are safe. Please try again or return to your dashboard.",
  homeHref = "/",
  homeLabel = "Back to Home",
  className,
}: ErrorViewProps) {
  React.useEffect(() => {
    // Technical error details remain strictly in the browser console for developers
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex w-full max-w-md flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-md sm:p-10",
        className,
      )}
    >
      <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-8 ring-amber-50/60">
        <AlertCircle className="size-8" aria-hidden="true" />
      </div>

      <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
        {title}
      </h1>

      <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
        {message}
      </p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
        {reset && (
          <Button
            type="button"
            onClick={reset}
            className="h-10 w-full sm:w-auto gap-2 border-[var(--brand)] bg-[#294D72] px-6 text-[13.5px] font-semibold text-white shadow-xs hover:bg-[#1E3B59] transition-colors"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        )}

        <Button
          asChild
          variant="outline"
          className="h-10 w-full sm:w-auto gap-2 border-slate-300 bg-white px-5 text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Link href={homeHref}>
            <Home className="size-4" aria-hidden="true" />
            {homeLabel}
          </Link>
        </Button>
      </div>
    </div>
  );
}
