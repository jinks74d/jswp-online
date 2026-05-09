"use client";

/**
 * Four cards, one per writing mode. Descriptions come from
 * lib/jswp-modes.ts (single source of truth). Clicking a card pushes
 * a query param, the parent page sees ?mode=… and renders the form.
 */

import Link from "next/link";
import { BookOpen, Scale, Feather, Moon, type LucideIcon } from "lucide-react";
import { MODES, type JswpMode } from "@/lib/jswp-modes";

const ICONS: Record<JswpMode, LucideIcon> = {
  expository: BookOpen,
  argumentation: Scale,
  literary: Feather,
  narrative: Moon,
};

export function ModePicker() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {(Object.keys(MODES) as JswpMode[]).map((m) => {
        const cfg = MODES[m];
        const Icon = ICONS[m];
        return (
          <Link
            key={m}
            href={`/dashboard/assignments/new?mode=${m}`}
            className="group block bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-500 hover:shadow-sm transition"
          >
            <div className="flex items-start gap-3">
              <Icon className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <h2 className="font-semibold text-gray-900">
                  {cfg.displayName}
                </h2>
                <p className="text-sm text-gray-600 mt-1">{cfg.description}</p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
