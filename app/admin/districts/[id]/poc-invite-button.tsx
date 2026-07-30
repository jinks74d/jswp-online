"use client";

/**
 * Per-POC "Invite" / "Re-send invite" button. Each instance owns its own
 * useActionState so multiple POC buttons on the district page report
 * independently. Calls inviteDistrictPoc, which sends a set-password link.
 */

import { useActionState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import {
  inviteDistrictPoc,
  type PocInviteState,
} from "@/lib/actions/districts";

const initialState: PocInviteState = {};

export function PocInviteButton({
  userId,
  districtId,
  alreadyInvited,
}: {
  userId: string;
  districtId: string;
  alreadyInvited: boolean;
}) {
  const [state, action, pending] = useActionState(
    inviteDistrictPoc,
    initialState
  );

  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="district_id" value={districtId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        ) : alreadyInvited ? (
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        {alreadyInvited ? "Re-send invite" : "Invite"}
      </button>
      {state.error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="mt-1 text-xs text-green-700">
          {state.success}
        </p>
      )}
    </form>
  );
}
