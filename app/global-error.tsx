"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import "@/app/globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log details only to the console for developers
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#E7EDF5] p-6 font-sans text-slate-900">
        <main
          role="alert"
          aria-live="assertive"
          className="flex w-full max-w-md flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg sm:p-10"
        >
          <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-8 ring-amber-50/60">
            <AlertCircle className="size-8" aria-hidden="true" />
          </div>

          <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            We couldn&apos;t load this page
          </h1>

          <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
            A temporary issue interrupted the application. Please try reloading or head back to the main portal.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#294D72] px-6 text-[13.5px] font-semibold text-white shadow-xs hover:bg-[#1E3B59] transition-colors"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Try again
            </button>

            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Home className="size-4" aria-hidden="true" />
              Back to Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
