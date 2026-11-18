"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CourseTabItem {
  id: string;
  label: string;
  href: string;
  badge?: number;
}

function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = `${count} pending join request${count === 1 ? "" : "s"}`;
  return (
    <span
      aria-label={label}
      title={label}
      className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#9D4C38] px-1 text-[10px] font-semibold leading-none text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Class-workspace section nav.
 *
 * The row sits on the same navy band as the page header below it, so the two
 * read as one surface. The tabs themselves are plain text; the selected one is
 * marked by a white pill that slides between slots as you move through the class.
 */
export function CourseTabs({
  tabs,
}: {
  tabs: CourseTabItem[];
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const active =
    tabs.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)) ?? tabs[0];
  const indicatorTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 38 };
  const [menuOpen, setMenuOpen] = React.useState(false);
  // Close the list on navigation (render-phase adjustment, no effect).
  const [openedAt, setOpenedAt] = React.useState(pathname);
  if (menuOpen && openedAt !== pathname) {
    setOpenedAt(pathname);
    setMenuOpen(false);
  }

  return (
    <div
      className="relative w-full shrink-0 border-b border-[#45698B] bg-[linear-gradient(112deg,#294D72_0%,#365F85_68%,#47759A_100%)]"
      onKeyDown={(event) => {
        if (event.key === "Escape") setMenuOpen(false);
      }}
    >
      {/* Below lg: centered active section. */}
      <div className="lg:hidden">
        <div className="flex h-10 items-center justify-center px-4">
          <button
            type="button"
            onClick={() => {
              setOpenedAt(pathname);
              setMenuOpen((v) => !v);
            }}
            aria-expanded={menuOpen}
            aria-controls="course-tab-menu"
            className="flex min-w-0 items-center justify-center gap-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)]"
          >
            <span className="truncate text-[13px] font-semibold text-white">{active.label}</span>
            <TabBadge count={active.badge ?? 0} />
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-[#DEE8F2] transition-transform motion-reduce:transition-none",
                menuOpen && "rotate-180",
              )}
            />
          </button>
        </div>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              id="course-tab-menu"
              className="absolute inset-x-0 top-full z-20 border-b border-[#DADADA] bg-white shadow-sm"
            >
              {tabs.map((tab) => {
                const isActive = tab.id === active.id;
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-ink)]",
                      isActive
                        ? "bg-[var(--brand)] font-semibold text-white"
                        : "text-[#5A5A5A] hover:bg-[#F7F7F7] hover:text-[#111]",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {tab.label}
                      <TabBadge count={tab.badge ?? 0} />
                    </span>
                    {isActive && (
                      <Check className="h-4 w-4 shrink-0 text-white" />
                    )}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* lg+: the navy band is the card; the active section is a white pill
          that slides between plain-text slots. */}
      <div className="hidden lg:block">
        <div className="flex w-full items-center justify-center px-6 py-2">
          <nav
            aria-label="Class sections"
            className="flex max-w-full items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex h-7 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-[12.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)]",
                    isActive
                      ? "font-semibold text-[var(--brand-ink)]"
                      : "font-medium text-[#DEE8F2] hover:bg-white/10 hover:text-white",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="course-tab-pill"
                      className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(16,34,59,0.35)]"
                      transition={indicatorTransition}
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {tab.label}
                    <TabBadge count={tab.badge ?? 0} />
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
