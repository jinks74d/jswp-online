// components/ui/DeleteConfirmationModal.tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, X, Trash2 } from "lucide-react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  itemName: string;
  loading?: boolean;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "DELETE",
  itemName,
  loading: _loading = false,
}: DeleteConfirmationModalProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const titleId = useId();
  const confirmFieldId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  // Remember the element that had focus before the dialog opened so we can
  // restore it on close (WCAG 2.4.3 Focus Order).
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const handleConfirm = async () => {
    if (confirmationText !== confirmText) {
      return;
    }

    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmationText("");
      onClose();
    }
  };

  // Capture the previously-focused element and move focus into the dialog
  // when it opens; restore focus to the trigger when it closes.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Initial focus on the cancel button (least destructive action).
    cancelButtonRef.current?.focus();

    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  // Escape closes the dialog (when not mid-delete); Tab is trapped within
  // the dialog so focus can't wander to the page behind it.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!isDeleting) {
          event.preventDefault();
          handleClose();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !panel.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // handleClose is stable for the purposes of this effect; re-bind only
    // when open/deleting state changes so the guard reads fresh values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isDeleting]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3
                id={titleId}
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h3>
            </div>
            <button
              onClick={handleClose}
              disabled={isDeleting}
              aria-label="Close dialog"
              className="flex h-6 w-6 items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4">
            <p className="text-gray-600">{message}</p>

            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700 font-medium mb-2">
                This action cannot be undone!
              </p>
              <p className="text-sm text-red-600">
                To confirm deletion, type <span className="font-mono font-bold">{confirmText}</span> below:
              </p>
            </div>

            <div>
              <label htmlFor={confirmFieldId} className="block text-sm font-medium text-gray-700 mb-2">
                Confirmation
              </label>
              <input
                id={confirmFieldId}
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder={`Type ${confirmText} to confirm`}
                disabled={isDeleting}
                className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 font-mono"
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Item to be deleted:</span> {itemName}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              ref={cancelButtonRef}
              onClick={handleClose}
              disabled={isDeleting}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirmationText !== confirmText || isDeleting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Forever
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
