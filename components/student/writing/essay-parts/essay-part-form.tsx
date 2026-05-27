"use client";

/**
 * Shared single-screen form used by all three essay-parts steps.
 * Each step entry passes:
 *   - pedagogyHint: the step's hint text, rendered as a help block
 *   - kindSelect (optional): { label, options, value, onSave } —
 *     for thesis_frame and introduction_hook_kind dropdowns. Each
 *     option carries a brief template/description string that
 *     surfaces below the dropdown when selected.
 *   - thesisContext (optional): read-only thesis text shown above
 *     the textarea (used by introduction + conclusion).
 *   - text + onTextSave: the textarea value and autosave callback.
 *
 * Continue button + gate are owned here. canContinue: text non-empty
 * trimmed.
 */

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useWritingMode } from "../use-writing-mode";

export interface SelectOption {
  value: string;
  label: string;
  description: string;
}

export interface KindSelectConfig<T extends string = string> {
  label: string;
  help: string;
  options: ReadonlyArray<SelectOption>;
  initialValue: T | null;
  onSave: (value: T | null) => Promise<void>;
}

interface Props<T extends string = string> {
  writingId: string;
  stepKey: string;
  textareaLabel: string;
  textareaHelp: string;
  textareaRows?: number;
  initialText: string;
  pedagogyHint: string | null;
  kindSelect?: KindSelectConfig<T>;
  thesisContext?: string | null;
  onTextSave: (value: string) => Promise<void>;
}

export function EssayPartForm<T extends string = string>({
  writingId,
  stepKey,
  textareaLabel,
  textareaHelp,
  textareaRows = 8,
  initialText,
  pedagogyHint,
  kindSelect,
  thesisContext,
  onTextSave,
}: Props<T>) {
  const { isReadOnly } = useWritingMode();
  const [text, setText] = useState(initialText);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canContinue = text.trim().length > 0;

  const onContinue = () => {
    setError(null);
    start(async () => {
      try {
        await completeStepAndAdvance(writingId, stepKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NEXT_REDIRECT") return;
        setError(msg || "Could not continue.");
      }
    });
  };

  return (
    <div className="space-y-4 max-w-3xl">
      {pedagogyHint && (
        <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-900">
          {pedagogyHint}
        </div>
      )}

      {thesisContext !== undefined && thesisContext !== null && thesisContext.trim() && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-amber-900 mb-0.5">
            Your thesis (read-only)
          </div>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">
            {thesisContext}
          </p>
        </div>
      )}

      {kindSelect && <KindSelect config={kindSelect} />}

      <div>
        <div className="text-sm font-medium text-gray-900">
          {textareaLabel}
        </div>
        {textareaHelp && (
          <p className="text-xs text-gray-500 mt-0.5">{textareaHelp}</p>
        )}
        <div className="mt-1.5">
          <AutoSaveInput
            multiline
            rows={textareaRows}
            initialValue={initialText}
            disabled={isReadOnly}
            onSave={async (next) => {
              setText(next);
              await onTextSave(next);
            }}
          />
        </div>
      </div>

      {!isReadOnly && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            {canContinue ? "Ready to continue." : "Write at least a sentence to continue."}
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <div className="text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={onContinue}
              disabled={!canContinue || pending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--district-primary)" }}
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              {pending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KindSelect<T extends string>({
  config,
}: {
  config: KindSelectConfig<T>;
}) {
  const { isReadOnly } = useWritingMode();
  const [value, setValue] = useState<string>(config.initialValue ?? "");
  // Keep a previously-saved value selectable even if it isn't in the
  // current (mode-specific) option list — otherwise switching option sets
  // would silently drop a stored selection. Append it as a passthrough.
  const options =
    config.initialValue &&
    !config.options.some((o) => o.value === config.initialValue)
      ? [
          ...config.options,
          {
            value: config.initialValue,
            label: config.initialValue,
            description: "Previously selected.",
          },
        ]
      : config.options;
  const selected = options.find((o) => o.value === value);

  return (
    <div>
      <div className="text-sm font-medium text-gray-900">{config.label}</div>
      {config.help && (
        <p className="text-xs text-gray-500 mt-0.5">{config.help}</p>
      )}
      <select
        value={value}
        disabled={isReadOnly}
        onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          const v = (value || null) as T | null;
          await config.onSave(v);
        }}
        className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white disabled:bg-gray-50"
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {selected && (
        <p className="mt-1.5 text-xs text-gray-600 italic">
          {selected.description}
        </p>
      )}
    </div>
  );
}
