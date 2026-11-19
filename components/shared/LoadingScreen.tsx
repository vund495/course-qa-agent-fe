import * as React from "react";
import { cn } from "@/lib/utils";

export interface LoadingScreenProps {
  label?: string;
  className?: string;
  fullScreen?: boolean;
}

/**
 * Centered spinning loader screen with label underneath.
 * Clean, modern circular spinner centered in the viewport.
 */
export function LoadingScreen({
  label = "Loading...",
  className,
  fullScreen = false,
}: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex flex-col items-center justify-center gap-4 text-center select-none",
        fullScreen
          ? "fixed inset-0 z-50 bg-[#F4F6F9]/80 backdrop-blur-xs"
          : "min-h-[75vh] w-full py-16",
        className,
      )}
    >
      <div className="relative flex items-center justify-center">
        <svg
          className="size-12 animate-spin text-[#294D72]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-20 text-[#294D72]"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-90 text-[#294D72]"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>

      <p className="text-[15px] font-medium tracking-wide text-slate-600">
        {label}
      </p>
    </div>
  );
}

export default LoadingScreen;
