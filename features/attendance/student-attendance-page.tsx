"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, RefreshCw } from "lucide-react";
import { AppSelect, type AppSelectOption } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { PAGE_COLUMN, PageContainer } from "@/components/shared/PageShell";
import { StudentAttendanceView } from "@/features/attendance/student-attendance-view";
import { studentApi, type StudentClass } from "@/lib/student-api";

/**
 * Student attendance workspace (AI-159).
 *
 * Mirrors `/teacher/attendance`: one top-level page with a class picker kept in
 * the `?classId=` query string, so the sidebar link works without a class in
 * the URL. Students only read their history — no leave or schedule controls.
 */
export function StudentAttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedClassId = searchParams.get("classId") ?? "";
  const [classes, setClasses] = React.useState<StudentClass[]>([]);
  const [selectedClassId, setSelectedClassId] = React.useState(requestedClassId);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadClasses = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await studentApi.classes();
      setClasses(rows);
      const nextClassId = rows.some((item) => item.id === requestedClassId)
        ? requestedClassId
        : rows[0]?.id ?? "";
      setSelectedClassId(nextClassId);
      if (nextClassId && nextClassId !== requestedClassId) {
        router.replace(`/student/attendance?classId=${encodeURIComponent(nextClassId)}`, {
          scroll: false,
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your classes.");
    } finally {
      setLoading(false);
    }
  }, [requestedClassId, router]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load enrolled classes when the route or requested class changes.
    void loadClasses();
  }, [loadClasses]);

  const options: AppSelectOption[] = classes.map((item) => ({
    value: item.id,
    label: item.name,
    description: item.code,
    initials: item.code.slice(0, 2).toUpperCase(),
  }));
  const selectedClass = classes.find((item) => item.id === selectedClassId);

  const classFilter = (
    <div className="w-full min-w-0 sm:w-72">
      <AppSelect
        id="student-attendance-class-filter"
        aria-label="Filter attendance by class"
        value={selectedClassId}
        onValueChange={(classId) => {
          setSelectedClassId(classId);
          router.replace(`/student/attendance?classId=${encodeURIComponent(classId)}`, {
            scroll: false,
          });
        }}
        options={options}
        placeholder="Select a class"
        triggerClassName="w-full"
        contentClassName="w-[var(--radix-select-trigger-width)] min-w-0"
      />
    </div>
  );

  if (loading) {
    return (
      <div className={PAGE_COLUMN} role="status" aria-label="Loading classes">
        <div className="h-32 animate-pulse rounded-xl border border-[#DADADA] bg-white" />
      </div>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div className="rounded-xl border border-red-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void loadClasses()}>
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Retry
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (!selectedClass) {
    return (
      <PageContainer>
        <div className="rounded-xl border border-dashed border-[#DADADA] bg-white p-8 text-center">
          <BookOpen className="mx-auto size-8 text-[#8A8A8A]" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold text-[#111111]">No enrolled classes</h1>
          <p className="mt-1 text-sm text-[#6F6F6F]">
            Attendance will appear after you enroll in a class.
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <StudentAttendanceView
      key={selectedClass.id}
      classId={selectedClass.id}
      classFilter={classFilter}
    />
  );
}
