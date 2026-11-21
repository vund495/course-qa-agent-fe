import Link from "next/link";
import { Compass, Home, BookOpen, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-[#E7EDF5] p-6 text-center">
      <div className="flex w-full max-w-lg flex-col items-center rounded-2xl border border-[#DADADA] bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-[#E5EFF8] text-[#294D72] ring-8 ring-[#E5EFF8]/60">
          <Compass className="size-8" aria-hidden="true" />
        </div>

        <span className="mb-2 inline-flex items-center rounded-full bg-[#E5EFF8] px-3 py-1 text-xs font-bold text-[#294D72]">
          404 ERROR
        </span>

        <h1 className="font-heading text-2xl font-bold tracking-tight text-[#111111] sm:text-3xl">
          Page Not Found
        </h1>

        <p className="mt-3 text-[14.5px] leading-relaxed text-[#5A5A5A]">
          We couldn&apos;t find the page you were looking for. The link may be broken, or the URL might have been moved.
        </p>

        <div className="mt-8 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
          <Button
            asChild
            className="h-10 gap-2 border-[var(--brand)] bg-[#294D72] px-5 text-[13.5px] font-semibold text-white shadow-xs hover:bg-[#1E3B59]"
          >
            <Link href="/">
              <Home className="size-4" aria-hidden="true" />
              Return Home
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 px-5 text-[13.5px] font-semibold text-[#111111]"
          >
            <Link href="/student/home">
              <GraduationCap className="size-4" aria-hidden="true" />
              Student Portal
            </Link>
          </Button>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 border-t border-[#EDEDED] pt-6 text-xs text-[#8F8F8F]">
          <Link
            href="/teacher/home"
            className="inline-flex items-center gap-1.5 hover:text-[#111111] transition-colors"
          >
            <BookOpen className="size-3.5" />
            Teacher Portal
          </Link>
          <span>•</span>
          <Link
            href="/landing"
            className="hover:text-[#111111] transition-colors"
          >
            Landing Page
          </Link>
        </div>
      </div>
    </main>
  );
}
