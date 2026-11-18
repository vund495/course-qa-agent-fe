"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One pager for every browsing list.
 *
 * Lists differ in where their rows come from (server envelope vs. client slice)
 * but not in how paging should read, so the control is shared: same wording,
 * same disabled states, same page-number window.
 */

function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

const controlClass =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border bg-white px-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40";

export function Pagination({
  page,
  pageCount,
  total,
  onChange,
  className,
  itemLabel = "items",
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
  itemLabel?: string;
}) {
  if (total === 0) return null;

  const window = pageWindow(page, pageCount);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-[12.5px] text-muted-foreground",
        className,
      )}
    >
      <span>
        Page {page} of {pageCount} · {total} {itemLabel}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={controlClass}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {window.map((entry, i) =>
          entry === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground/70">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onChange(entry)}
              aria-current={entry === page ? "page" : undefined}
              className={cn(
                controlClass,
                entry === page &&
                  "border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]",
              )}
            >
              {entry}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className={controlClass}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
