"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * One content column for the whole app shell.
 *
 * No max-width: the content fills whatever space the sidebar leaves, so wide
 * monitors do not show empty gutters beside the cards. Change the padding here
 * only.
 */
export const PAGE_COLUMN = "w-full px-6 pt-8 pb-12";

export function PageContainer({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn(PAGE_COLUMN, className)} {...props}>
      {children}
    </div>
  );
}
