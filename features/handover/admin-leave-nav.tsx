"use client";
import * as React from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { handoverApi } from "@/lib/handover-api";

export function AdminLeaveNav({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const [pending, setPending] = React.useState<number | null>(null);
  React.useEffect(() => {
    let active = true;
    const load = () => {
      handoverApi
        .listAdminLeaves("pending")
        .then((rows) => {
          if (active) setPending(rows.length);
        })
        .catch(() => {
          if (active) setPending(null);
        });
    };
    load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener("admin-leaves-changed", load);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("admin-leaves-changed", load);
      window.removeEventListener("focus", load);
    };
  }, []);
  const label =
    pending === null ? "Leave requests" : `Leave requests (${pending} pending)`;
  return (
    <Link
      href="/admin/leaves"
      title={label}
      aria-label={label}
      className={className}
    >
      <CalendarClock className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <>
          <span>Leave requests</span>
          {pending !== null && (
            <span
              className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-100 px-1.5 text-[11px] font-bold leading-none tabular-nums text-amber-950 shadow-sm"
              aria-label={`${pending} pending requests`}
            >
              {pending}
            </span>
          )}
        </>
      )}
    </Link>
  );
}
