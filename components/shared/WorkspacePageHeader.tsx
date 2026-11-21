import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkspacePageHeaderProps = {
  title: string;
  subtitle?: string;
  id?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /**
   * Back target rendered as a chevron beside the title. Keeping it inside the
   * header is what lets the header stay flush under the tabs — a link above the
   * header would force `bleedTop={false}` and open a grey gap.
   */
  backLink?: { href: string; label: string };
  /**
   * Bleed to the container's horizontal gutters. Correct inside a container
   * that already provides the page gutters (PageContainer, class workspace
   * layout). Set to false only when the header sits in a container without
   * those gutters — the negative margin would otherwise pull it past the
   * viewport.
   */
  bleed?: boolean;
  /**
   * Pull the header up over the container's top padding so it sits flush under
   * the tabs. Only correct when the header is the first element on the page;
   * set to false when a back-link or breadcrumb sits above it.
   */
  bleedTop?: boolean;
};

/** A compact, shared heading surface for role and class workspaces. */
export function WorkspacePageHeader({
  title,
  subtitle,
  id,
  badge,
  actions,
  className,
  backLink,
  bleed = true,
  bleedTop = true,
}: WorkspacePageHeaderProps) {
  return (
    <header
      className={cn(
        "relative isolate flex min-h-[92px] flex-col justify-center overflow-hidden border border-[#45698B] bg-[linear-gradient(112deg,#294D72_0%,#365F85_68%,#47759A_100%)] px-4 py-3 shadow-[0_8px_24px_rgba(23,51,83,0.12)] sm:px-5 md:px-6",
        bleed && "-mx-6",
        bleedTop && "-mt-8",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] sm:block"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "linear-gradient(to right, transparent, black 46%)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 46%)",
        }}
      />
      <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* DOM order is title → subtitle → actions so phones read naturally.
            From sm up the actions move up beside the title (order-2) and the
            subtitle takes its own full-width row underneath (order-3). */}
        <div className="order-1 flex min-w-0 flex-wrap items-center gap-2">
          {backLink && (
            <Link
              href={backLink.href}
              aria-label={`Back to ${backLink.label}`}
              title={`Back to ${backLink.label}`}
              className="-ml-1 flex size-7 shrink-0 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
          )}
          <h1 id={id} className="font-heading text-balance text-[21px] font-bold leading-tight tracking-tight text-white sm:text-[24px]">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="order-2 w-full text-[13px] leading-relaxed text-[#DEE8F2] sm:order-3 sm:basis-full">
            {subtitle}
          </p>
        )}
        {actions && (
          <div className="order-3 flex w-full flex-wrap items-center gap-2 sm:order-2 sm:ml-auto sm:w-auto sm:shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
