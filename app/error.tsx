"use client";

import { ErrorView } from "@/components/shared/ErrorView";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-[#E7EDF5] p-6">
      <ErrorView
        error={error}
        reset={reset}
        title="We couldn't load this page"
        message="A temporary connection issue occurred. Please try refreshing the page or return to the home screen."
        homeHref="/"
        homeLabel="Back to Home"
      />
    </main>
  );
}
