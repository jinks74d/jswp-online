"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";

/**
 * Drop-in logout button. Wraps signOutAction in a tiny form so the action
 * runs server-side and the redirect happens via the action itself. Style
 * with className like any other button.
 */
export function LogoutButton({
  className,
  children = "Sign out",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <form action={signOutAction}>
      <SubmitButton className={className}>{children}</SubmitButton>
    </form>
  );
}

function SubmitButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
      }
    >
      <LogOut className="w-4 h-4" />
      {pending ? "Signing out..." : children}
    </button>
  );
}
