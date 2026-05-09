"use client";

/**
 * Click-toggle dropdown anchored to the user's name in the header.
 * Plain useState + useRef + click-outside listener — no Headless UI.
 * Logout uses the existing signOutAction server action.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import type { ShellProfile } from "./teacher-shell";

export function UserMenu({ profile }: { profile: ShellProfile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email ||
    "Account";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-700 hover:bg-gray-100"
      >
        <span className="font-medium">{displayName}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-900">
              {displayName}
            </div>
            {profile.email && (
              <div className="text-xs text-gray-500 truncate">
                {profile.email}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1 capitalize">
              {profile.role.replace("_", " ")}
            </div>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
