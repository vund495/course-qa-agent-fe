import { Suspense } from "react";
import { TeacherAttendancePage } from "@/features/attendance/teacher-attendance-page";

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6" role="status" aria-label="Loading attendance">
          <div className="h-32 animate-pulse rounded-xl border border-[#DADADA] bg-white" />
        </div>
      }
    >
      <TeacherAttendancePage />
    </Suspense>
  );
}
