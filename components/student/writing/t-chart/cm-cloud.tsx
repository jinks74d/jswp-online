"use client";

/**
 * Green commentary "cloud" — the JSWP worksheet's oval-with-rays that holds a
 * chunk's commentary (design base: T-Chart Worksheet.html). A CSS ellipse
 * (border-radius 50%) so it grows with the CM text, four decorative rays at
 * the diagonals, and centered green content. Purely presentational; the CM
 * editing lives in the children.
 */

import type { ReactNode } from "react";

const GREEN = "#15803d";

function Ray({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute h-0 w-5 border-t-2 ${className}`}
      style={{ borderColor: GREEN }}
    />
  );
}

export function CmCloud({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[300px] items-center justify-center">
      <div className="relative w-full">
        {/* rays at the four diagonals */}
        <Ray className="-top-1 -left-2 -rotate-[35deg]" />
        <Ray className="-top-1 -right-2 rotate-[35deg]" />
        <Ray className="-bottom-1 -left-2 rotate-[35deg]" />
        <Ray className="-bottom-1 -right-2 -rotate-[35deg]" />

        {/* the oval */}
        <div
          className="flex min-h-[128px] flex-col items-center justify-center gap-1.5 rounded-[50%] border-2 px-[14%] py-6 text-center"
          style={{ borderColor: GREEN }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
