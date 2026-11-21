"use client";

import { ErrorView } from "@/components/shared/ErrorView";

export default function TeacherRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <ErrorView
        error={error}
        reset={reset}
        title="We couldn't load this workspace"
        message="A temporary connection issue occurred while retrieving your class materials. Please try again or return to your teacher dashboard."
        homeHref="/teacher/home"
        homeLabel="Back to Dashboard"
      />
    </div>
  );
}
