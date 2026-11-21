"use client";

import { ErrorView } from "@/components/shared/ErrorView";

export default function StudentRouteError({
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
        title="We couldn't load your classes"
        message="A temporary connection issue interrupted this page. Your progress and class work are completely safe. Please try refreshing or return to your student dashboard."
        homeHref="/student/home"
        homeLabel="Back to Dashboard"
      />
    </div>
  );
}
