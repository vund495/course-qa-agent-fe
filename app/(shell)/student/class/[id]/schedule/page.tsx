"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { ClassPageHeader } from "@/components/shared/ClassPageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SkeletonCard, SkeletonLine } from "@/components/shared/page-skeleton";
import { attendanceApi, type StudentSchedule } from "@/lib/attendance-api";
import { ClassHolidayCalendar } from "@/features/attendance/class-holiday-calendar";
import {
  MonthSchedule,
  ScheduleViewToggle,
  WeekSchedule,
  formatMonthKey,
  formatMonthTitle,
  readStoredScheduleView,
  scheduleRange,
  storeScheduleView,
  type ScheduleView,
} from "@/features/attendance/student-schedule";
import {
  addWeeks,
  formatWeekRange,
  getMonday,
} from "@/features/attendance/attendance-week-picker";
import {
  getAdjacentMonth,
  getCurrentMonth,
} from "@/features/attendance/student-attendance-history";

function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function StudentSchedulePage() {
  const params = useParams();
  const classId = (params?.id as string) ?? "";

  const [view, setView] = React.useState<ScheduleView>("week");
  const [preferenceReady, setPreferenceReady] = React.useState(false);
  const [weekStart, setWeekStart] = React.useState<string>(() => getMonday());
  const [month, setMonth] = React.useState<string>(() => getCurrentMonth());
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);

  const [data, setData] = React.useState<StudentSchedule | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Restore the last week/month choice after hydration. Reading localStorage in
  // the initial render would make the server and client HTML disagree.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time preference restore after mount
    setView(readStoredScheduleView());
    setPreferenceReady(true);
  }, []);

  const range = React.useMemo(
    () => scheduleRange(view, weekStart, month),
    [view, weekStart, month],
  );

  const loadSchedule = React.useCallback(async () => {
    if (!classId || !preferenceReady) return;
    setLoading(true);
    setError(null);
    try {
      const result = await attendanceApi.mySchedule(classId, range.from, range.to);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your schedule");
    } finally {
      setLoading(false);
    }
  }, [classId, preferenceReady, range.from, range.to]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on view/range change
    void loadSchedule();
  }, [loadSchedule]);

  const selectedToday = data?.today ?? localToday();

  const handleViewChange = (nextView: ScheduleView) => {
    if (nextView === view) return;

    if (nextView === "month") {
      setMonth(formatMonthKey(weekStart));
      setSelectedDate(null);
    } else {
      setWeekStart(getMonday(selectedDate ?? selectedToday));
    }

    setView(nextView);
    storeScheduleView(nextView);
  };

  const handlePrevious = () => {
    if (view === "week") {
      setWeekStart((current) => addWeeks(current, -1));
      return;
    }
    setMonth((current) => getAdjacentMonth(current, -1));
    setSelectedDate(null);
  };

  const handleNext = () => {
    if (view === "week") {
      setWeekStart((current) => addWeeks(current, 1));
      return;
    }
    setMonth((current) => getAdjacentMonth(current, 1));
    setSelectedDate(null);
  };

  const handleToday = () => {
    if (view === "week") {
      setWeekStart(getMonday(selectedToday));
    } else {
      setMonth(formatMonthKey(selectedToday));
      setSelectedDate(selectedToday);
    }
  };

  return (
    <div className="space-y-6">
      <ClassPageHeader
        title="My Schedule"
        subtitle="See your weekly and monthly class times, meeting links, holidays and attendance status."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSchedule()}
            disabled={loading || !preferenceReady}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <section
        data-testid="schedule-toolbar"
        className="flex flex-col gap-3 rounded-xl border border-[#E5E5E5] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-wrap items-center gap-3">
          <ScheduleViewToggle view={view} onChange={handleViewChange} />

          <div className="flex items-center gap-2">
            {view === "week" ? (
              <Calendar className="size-4 text-[#5A5A5A]" />
            ) : (
              <CalendarDays className="size-4 text-[#5A5A5A]" />
            )}
            <span
              data-testid="schedule-range-label"
              className="text-sm font-semibold text-[#111111]"
            >
              {view === "week" ? formatWeekRange(weekStart) : formatMonthTitle(month)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={loading}
            aria-label={view === "week" ? "Previous week" : "Previous month"}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToday}
            disabled={loading}
            className="text-xs font-medium"
          >
            {view === "week" ? "This week" : "This month"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={loading}
            aria-label={view === "week" ? "Next week" : "Next month"}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </section>

      <ClassHolidayCalendar classId={classId} />

      {error && (
        <Alert
          data-testid="schedule-error-state"
          variant="destructive"
          className="bg-rose-50 border-rose-200 text-rose-800"
        >
          <AlertCircle className="size-4 text-rose-600" />
          <AlertTitle className="font-semibold text-rose-900">Connection Error</AlertTitle>
          <AlertDescription className="mt-1 flex flex-col gap-2">
            <span>{error}</span>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadSchedule()}
                className="bg-white border-rose-300 hover:bg-rose-100 text-rose-900 font-medium"
              >
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {(loading || !preferenceReady) && (
        <div data-testid="schedule-loading-skeleton" className="space-y-4">
          <SkeletonLine className="h-5 w-48" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
            {[1, 2, 3, 4, 5, 6, 7].map((index) => (
              <SkeletonCard key={index} className="h-44" />
            ))}
          </div>
        </div>
      )}

      {!loading && !error && data && view === "week" && (
        <WeekSchedule data={data} weekStart={weekStart} />
      )}

      {!loading && !error && data && view === "month" && (
        <MonthSchedule
          data={data}
          month={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}
    </div>
  );
}
