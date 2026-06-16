"use client";

/**
 * Editable list of role-tagged sentences (CD or CM) for one chunk on the
 * Shaping Sheet. Each entry is an AutoSaveInput; add/remove manage the array.
 *
 * The array is owned in LOCAL STATE (seeded from the server prop) so that
 * rapid edits across slots can't clobber one another. The earlier version
 * rebuilt the array from the `sentences` prop on every save; because that prop
 * only refreshes after revalidatePath round-trips, tabbing between fields
 * faster than the round-trip made each save start from a stale snapshot — the
 * last save won and reverted earlier slots to "". That blanked CD/CM
 * sentences (the Paragraph Form then showed only the last one).
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import { RoleShapeLabel, type ShapeRole } from "@/components/jswp-color/role-shape";
import { useWritingMode } from "../use-writing-mode";

export const ROLE_COLOR_VAR: Record<ShapeRole, string> = {
  ts: "var(--jswp-color-ts)",
  cd: "var(--jswp-color-cd)",
  cm: "var(--jswp-color-cm)",
  cs: "var(--jswp-color-cs)",
};

// Static literal classes so Tailwind's content scanner generates them
// (a dynamically built `text-[color:${var}]` string would not register).
export const ROLE_TEXT_CLASS: Record<ShapeRole, string> = {
  ts: "text-[color:var(--jswp-color-ts)]",
  cd: "text-[color:var(--jswp-color-cd)]",
  cm: "text-[color:var(--jswp-color-cm)]",
  cs: "text-[color:var(--jswp-color-cs)]",
};

export function SentenceList({
  role,
  label,
  helpText,
  sentences,
  onSave,
}: {
  role: ShapeRole;
  label: string;
  helpText: string;
  sentences: readonly string[];
  onSave: (next: string[]) => Promise<void>;
}) {
  const { isReadOnly } = useWritingMode();
  const [pending, start] = useTransition();
  const colorVar = ROLE_COLOR_VAR[role];
  const textClass = ROLE_TEXT_CLASS[role];

  // Own the array locally so concurrent slot edits compute from the current
  // value, not the server prop (which lags behind revalidate). itemsRef keeps
  // the latest array available to async save callbacks without stale closures.
  const [items, setItems] = useState<string[]>(() => sentences.slice());
  const itemsRef = useRef(items);
  const dirtyRef = useRef(false);

  const apply = (next: string[]) => {
    itemsRef.current = next;
    dirtyRef.current = true;
    setItems(next);
  };

  // Adopt the server prop until the student first edits; after that this
  // component is the single writer for the session, so ignore prop echoes
  // (our own saves revalidate back to the same value, and there is no other
  // writer for a student's shaping sheet).
  useEffect(() => {
    if (!dirtyRef.current) {
      itemsRef.current = sentences.slice();
      setItems(itemsRef.current);
    }
  }, [sentences]);

  const persist = async (next: string[]) => {
    apply(next);
    await onSave(next);
  };

  const updateAt = (i: number, value: string): string[] => {
    const next = itemsRef.current.slice();
    next[i] = value;
    return next;
  };
  const removeAt = (i: number): string[] => {
    const next = itemsRef.current.slice();
    next.splice(i, 1);
    return next;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <RoleShapeLabel role={role} />
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: colorVar }}
        >
          {label}
        </span>
      </div>
      <p className="text-xs text-gray-500">{helpText}</p>
      {items.length === 0 && (
        <p className="text-xs text-gray-500 italic">
          No sentences yet. Click [Add sentence] to start.
        </p>
      )}
      {items.map((s, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <AutoSaveInput
              multiline
              rows={2}
              initialValue={s}
              disabled={isReadOnly}
              className={textClass}
              onSave={async (value) => {
                await persist(updateAt(i, value));
              }}
            />
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => start(async () => persist(removeAt(i)))}
              disabled={pending}
              title="Remove sentence"
              className="mt-1 text-gray-400 hover:text-red-700 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      ))}
      {!isReadOnly && (
        <button
          type="button"
          onClick={() => start(async () => persist([...itemsRef.current, ""]))}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Add sentence
        </button>
      )}
    </div>
  );
}
