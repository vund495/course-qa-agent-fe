import { Suspense } from "react";
import { TeacherAttendancePage } from "@/features/attendance/teacher-attendance-page";

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full px-6 pt-8 pb-12" role="status" aria-label="Loading attendance">
          <div className="h-32 animate-pulse rounded-xl border border-[#DADADA] bg-white" />
        </div>
      }
    >
      <TeacherAttendancePage />
    </Suspense>
  );
}
