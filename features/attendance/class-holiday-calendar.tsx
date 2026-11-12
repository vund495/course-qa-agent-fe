"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatIsoDateForDisplay } from "@/components/ui/date-input";
import { holidayApi, type Holiday } from "@/lib/holiday-api";

export function ClassHolidayCalendar({
  classId,
  initialDate = new Date(),
}: {
  classId: string;
  initialDate?: Date;
}) {
  const [month, setMonth] = React.useState(
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const year = month.getFullYear();
  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(month);
  const [holidays, setHolidays] = React.useState<Holiday[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);
  const visibleHolidays = holidays.filter((holiday) => {
    const date = new Date(`${holiday.date}T00:00:00`);
    return date.getFullYear() === year && date.getMonth() === month.getMonth();
  });

  React.useEffect(() => {
    if (!classId) return;
    let active = true;
    /* eslint-disable react-hooks/set-state-in-effect -- reload the selected calendar year. */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    holidayApi
      .listClass(classId, year)
      .then((rows) => {
        if (active) setHolidays(rows);
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load the holiday calendar.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, reload, year]);

  return (
    <section
      aria-label="Holiday calendar"
      className="rounded-xl border border-[#DADADA] bg-white p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
              <CalendarDays className="size-4" aria-hidden="true" />
            </span>
            Holiday calendar
          </h2>
          <p className="ml-10 mt-0.5 text-xs text-[#6F6F6F]">Days off for this class</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-1">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="size-7 px-0"
            aria-label="Previous month"
            onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span aria-live="polite" className="min-w-32 text-center text-sm font-semibold text-[#242424]">
            {monthLabel}
          </span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="size-7 px-0"
            aria-label="Next month"
            onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-[#6F6F6F]" role="status">
          Loading holidays…
        </p>
      ) : error ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-red-700" role="alert">
          <span className="flex-1">{error}</span>
          <Button size="xs" variant="outline" onClick={() => setReload((value) => value + 1)}>
            <RefreshCw className="size-3" />
            Reload
          </Button>
        </div>
      ) : visibleHolidays.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-[#E5E5E5] bg-[#FAFAFA] px-3 py-3">
          <CalendarDays className="size-4 shrink-0 text-[#8A8A8A]" aria-hidden="true" />
          <p className="text-sm text-[#6F6F6F]">
            No holidays this month <span className="font-medium text-[#444444]">· {monthLabel}</span>
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[#EFEFEF] overflow-hidden rounded-lg border border-[#EAEAEA]">
          {visibleHolidays.map((holiday) => {
            const date = new Date(`${holiday.date}T00:00:00`);
            return (
              <li
                key={holiday.id}
                className="flex min-w-0 items-center gap-3 bg-white px-3 py-2.5 transition-colors duration-150 hover:bg-amber-50/40 sm:px-4"
              >
                <time
                  dateTime={holiday.date}
                  className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-amber-50 text-amber-900"
                >
                  <span className="text-base font-semibold leading-none tabular-nums">
                    {date.getDate()}
                  </span>
                  <span className="mt-1 text-[9px] font-semibold uppercase leading-none tracking-wide">
                    {new Intl.DateTimeFormat("en", { month: "short" }).format(date)}
                  </span>
                </time>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#242424]">{holiday.name}</p>
                  <p className="mt-0.5 text-xs text-[#737373]">
                    {formatIsoDateForDisplay(holiday.date)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-900">
                  {holiday.scope === "class" ? "Class holiday" : "Public holiday"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
