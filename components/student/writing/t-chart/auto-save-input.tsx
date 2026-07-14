"use client";

/**
 * Reusable input/textarea wrapper for the T-chart's many cells. Holds
 * its own draft state, fires onSave on blur with the full string, and
 * shows a tiny "Saved" flash. Avoids re-implementing the pattern in
 * 6+ places (TS, CS, CDs, CMs, narrative cells, etc.).
 *
 * Save errors surface as a small red dot to the right of the field;
 * the parent doesn't need to thread error UX into every cell.
 */

import { useEffect, useRef, useState } from "react";

interface BaseProps {
  initialValue: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /**
   * Accessible name for the field. A placeholder is NOT an accessible name
   * (it disappears on input and isn't reliably announced), so every caller
   * should pass the field's role/context here — e.g. "Concrete detail",
   * "Commentary", "Ray word 1". Threaded to aria-label. WCAG 3.3.2 / 4.1.2.
   */
  ariaLabel?: string;
  /**
   * Drop the default bordered-box chrome so the caller fully controls the
   * field's look via `className` (used by the worksheet-style T-Chart, whose
   * fields sit on ruled/underlined "paper" rather than in input boxes). The
   * autosave logic and "Saved" indicator are unchanged.
   */
  bare?: boolean;
  onSave: (value: string) => Promise<void>;
}

interface InputProps extends BaseProps {
  multiline?: false;
}
interface TextareaProps extends BaseProps {
  multiline: true;
  rows?: number;
}

type Props = InputProps | TextareaProps;

export function AutoSaveInput(props: Props) {
  const [value, setValue] = useState(props.initialValue);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  // If the prop value changes from the server (revalidate), pick it up
  // unless the user is mid-edit (we don't stomp on focused inputs).
  const isFocusedRef = useRef(false);
  useEffect(() => {
    if (!isFocusedRef.current) {
      setValue(props.initialValue);
    }
  }, [props.initialValue]);

  const handleBlur = async () => {
    isFocusedRef.current = false;
    if (value === props.initialValue) {
      return; // no change
    }
    setStatus("saving");
    try {
      await props.onSave(value);
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1200);
    } catch (e) {
      console.error("AutoSaveInput save failed:", e);
      setStatus("error");
    }
  };

  // The bare variant drops the input box chrome for the worksheet "paper"
  // look, but must still show a visible focus indicator (WCAG 2.4.7). A
  // focus-visible ring gives keyboard users a cue without boxing the field
  // for mouse users.
  const baseClassName = props.bare
    ? "w-full resize-none bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:rounded-sm disabled:opacity-70"
    : "w-full rounded-md border border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50";
  const className = `${baseClassName} ${props.className ?? ""}`.trim();

  const indicator = (
    <span
      className="absolute right-2 top-2 text-xs text-gray-500 pointer-events-none"
      aria-live="polite"
    >
      {status === "saving" && "Saving…"}
      {status === "saved" && (
        <span className="text-green-600">Saved</span>
      )}
      {status === "error" && (
        <span className="text-red-600">Retry?</span>
      )}
    </span>
  );

  if (props.multiline) {
    return (
      <div className="relative">
        <textarea
          value={value}
          rows={props.rows ?? 3}
          placeholder={props.placeholder}
          aria-label={props.ariaLabel ?? props.placeholder}
          disabled={props.disabled}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={handleBlur}
          className={className}
        />
        {indicator}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder={props.placeholder}
        aria-label={props.ariaLabel}
        disabled={props.disabled}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={handleBlur}
        className={className}
      />
      {indicator}
    </div>
  );
}
