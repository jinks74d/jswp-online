"use client";

/**
 * Tabbed container for the school-detail sections (School admins, Teachers,
 * Subjects & classes). The server component renders each panel's full content —
 * tables, add forms, CSV importers, the subjects link — and passes it in as
 * `content`; this client wrapper only owns which tab is visible. Keyboard:
 * ←/→/Home/End move between tabs. Pass `count` only for tabs that have one.
 */

import { useId, useRef, useState, type ReactNode } from "react";

export type SchoolTab = {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
};

export function SchoolTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: readonly SchoolTab[];
}) {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (i: number) => {
    setActive(i);
    tabRefs.current[i]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = tabs.length - 1;
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusTab(active === last ? 0 : active + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusTab(active === 0 ? last : active - 1);
        break;
      case "Home":
        e.preventDefault();
        focusTab(0);
        break;
      case "End":
        e.preventDefault();
        focusTab(last);
        break;
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-0.5 w-5 rounded-full bg-[var(--brand)]" aria-hidden="true" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </h2>
      </div>

      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 border-b border-gray-200"
      >
        {tabs.map((tab, i) => {
          const selected = i === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              onClick={() => setActive(i)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${
                selected
                  ? "border-[var(--brand)] text-gray-900"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                    selected
                      ? "bg-[var(--brand-soft-strong)] text-[var(--brand)]"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={i !== active}
          className="pt-5"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
