"use client";

import { ErrorView } from "@/components/shared/ErrorView";

export default function AdminRouteError({
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
        title="We couldn't load this admin view"
        message="A temporary system issue prevented this view from loading. Please try again or return to the admin home."
        homeHref="/admin/home"
        homeLabel="Back to Dashboard"
      />
    </div>
  );
}
