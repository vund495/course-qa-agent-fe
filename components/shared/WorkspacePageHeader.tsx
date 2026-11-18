import * as React from "react";
import { cn } from "@/lib/utils";

type WorkspacePageHeaderProps = {
  title: string;
  subtitle?: string;
  id?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/** A compact, shared heading surface for role and class workspaces. */
export function WorkspacePageHeader({
  title,
  subtitle,
  id,
  badge,
  actions,
  className,
}: WorkspacePageHeaderProps) {
  return (
    <header
      className={cn(
        "relative isolate -mx-6 -mt-8 flex min-h-[92px] flex-col justify-center overflow-hidden border border-[#45698B] bg-[linear-gradient(112deg,#294D72_0%,#365F85_68%,#47759A_100%)] px-4 py-3 shadow-[0_8px_24px_rgba(23,51,83,0.12)] sm:px-5 md:px-6",
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
